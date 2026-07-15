import useEnvResources from '@/components/hooks/use-env-resources';
import { ComputeEnvironment } from '@/types/environments';
import { ComputeResource } from '@oceanprotocol/lib';
import { useMemo } from 'react';

export type MergedGpu = {
  /** Key used to address this type in the selection map (description, or a synthetic fallback). */
  key: string;
  description?: string;
  /** Total units of this type the environment advertises (the physical ceiling). */
  max: number;
  /** Units of this type actually free right now (max − inUse). The pickable ceiling. */
  available: number;
  /** Per-unit fee for this type (units of one description share a fee — the first id's). */
  fee: number;
};

/** How many units of each GPU type (keyed by MergedGpu.key) the user wants to use. */
export type GpuSelection = Record<string, number>;

/**
 * Scale a resource by a fraction, clamping to min/max.
 * If the resource is undefined or has no total/max, return 0.
 * When rounding, a positive fraction never rounds down to 0 — a resource that exists is requested
 * with at least 1 unit, so a small GPU-fraction selection can't send the node an amount:0 CPU
 * request (which the node rejects / would schedule a resource-less container).
 */
function fractionResourceClamped(resource: ComputeResource | undefined, fraction: number, round?: boolean): number {
  if (!resource) {
    return 0;
  }
  const fractionedResource = (resource.total ?? resource.max ?? 0) * fraction;
  let roundedResource = round ? Math.round(fractionedResource) : fractionedResource;
  if (round && fraction > 0 && roundedResource < 1) {
    roundedResource = 1;
  }
  if (roundedResource > resource.max) {
    return resource.max;
  }
  if ((resource.min || resource.min === 0) && roundedResource < resource.min) {
    return resource.min;
  }
  return roundedResource;
}

/**
 * Inference always books a whole environment, but the user may choose to use only some of the GPU
 * units — per type. Every other resource (CPU / RAM / disk) and the price scale by the overall
 * fraction of units selected: pick 5 of 6 units → get 5/6 of everything. CPU cores stay whole.
 * Allocation is kept between min/max for each resource type, and the price is calculated based on the actual units selected.
 *
 * When an environment has no GPUs, the fraction is 1 (the whole environment is used).
 *
 * The selection is bounded by what's actually AVAILABLE, not just the physical max: per-type units
 * are capped at that type's free units (max − inUse), and the overall unit count is further capped so
 * the proportional CPU/RAM/disk slice never exceeds those resources' free amounts. A user can't book
 * more than the node can currently give — the node would reject the serviceStart otherwise.
 */
const useInferenceAllocation = ({
  environment,
  tokenAddress,
  gpuSelection,
  durationSeconds,
}: {
  environment: ComputeEnvironment;
  tokenAddress: string;
  /** Omit to use every unit of every type (the default, whole-environment allocation). */
  gpuSelection?: GpuSelection;
  durationSeconds: number;
}) => {
  const { cpu, cpuAvailable, cpuFee, disk, diskAvailable, diskFee, gpus, gpusAvailable, gpuFees, ram, ramAvailable, ramFee } =
    useEnvResources({
      environment,
      freeCompute: false,
      tokenAddress,
    });

  /**
   * Merge units of the same description into one type, summing both the physical ceiling (max) and the
   * units currently free (gpusAvailable, i.e. max − inUse) across every id of that type. The fee is the
   * first id's — units of one description share a fee, so no averaging needed.
   */
  const mergedGpus = useMemo<MergedGpu[]>(() => {
    return gpus.reduce((merged, gpu) => {
      const key = gpu.description || 'GPU';
      const existing = merged.find((g) => g.key === key);
      if (existing) {
        existing.max += gpu.max ?? 0;
        existing.available += gpusAvailable[gpu.id] ?? 0;
      } else {
        merged.push({
          key,
          description: gpu.description,
          max: gpu.max ?? 0,
          available: gpusAvailable[gpu.id] ?? 0,
          fee: gpuFees[gpu.id] ?? 0,
        });
      }
      return merged;
    }, [] as MergedGpu[]);
  }, [gpus, gpusAvailable, gpuFees]);

  const totalGpus = useMemo(() => mergedGpus.reduce((sum, g) => sum + g.max, 0), [mergedGpus]);

  /**
   * A GPU unit's proportional share of each shared resource is (capacity / totalGpus).
   * Bound how many units the free CPU/RAM/disk can back: another tenant can leave GPUs free but too little shared
   * capacity to run them, so this can be lower than the count of free GPU units. No-GPU envs are one whole unit.
   */
  const maxUnitsByResources = useMemo(() => {
    if (totalGpus <= 0) {
      return 1;
    }
    const unitsThatFit = (available: number, resource: ComputeResource | undefined): number => {
      const per = (resource?.total ?? resource?.max ?? 0) / totalGpus;
      if (per <= 0) {
        return totalGpus; // resource doesn't constrain (none required per unit)
      }
      return Math.floor(available / per);
    };
    return Math.min(
      unitsThatFit(cpuAvailable, cpu),
      unitsThatFit(ramAvailable, ram),
      unitsThatFit(diskAvailable, disk)
    );
  }, [totalGpus, cpu, cpuAvailable, ram, ramAvailable, disk, diskAvailable]);

  /**
   * Independent pickable ceiling per type: its own free units. This is NOT bounded by the shared
   * CPU/RAM/disk budget — that budget caps the COMBINED selection across types (maxUnitsByResources),
   * enforced by the caller as units are picked. Reserving the shared budget per type in declaration
   * order would wrongly zero later types and forbid valid combos (e.g. pick all of type B, none of A).
   */
  const maxByKey = useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    mergedGpus.forEach((g) => {
      result[g.key] = g.available;
    });
    return result;
  }, [mergedGpus]);

  /**
   * Resolve selected units per type.
   *  - No selection for a type → default to its pickable ceiling (free units bounded by shared res).
   *  - Explicit request → honor it, clamped to the PHYSICAL max, not current availability. An explicit 
   * selection is either the user's live pick (already capped to maxByKey by the card's chips) or a 
   * fixed record of an already-booked service (manage / payment / summary). Clamping the latter to 
   * current availability would under-report what was actually booked once other tenants fill units.
   */
  const selectedByKey = useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    // Default (no explicit selection): fill types in declared order up to the combined shared-resource
    // budget, so the whole-environment default never asks for more units than CPU/RAM/disk can back.
    let remaining = Math.max(0, maxUnitsByResources);
    mergedGpus.forEach((g) => {
      const requested = gpuSelection?.[g.key];
      if (requested === undefined) {
        const cap = Math.min(maxByKey[g.key] ?? 0, remaining);
        result[g.key] = cap;
        remaining -= cap;
      } else {
        result[g.key] = Math.min(Math.max(requested, 0), g.max);
      }
    });
    return result;
  }, [mergedGpus, maxByKey, maxUnitsByResources, gpuSelection]);

  const selectedTotal = useMemo(
    () => Object.values(selectedByKey).reduce((sum, n) => sum + n, 0),
    [selectedByKey]
  );

  const fraction = totalGpus > 0 ? selectedTotal / totalGpus : 1;

  const allocation = useMemo(() => {
    return {
      cpu: fractionResourceClamped(cpu, fraction, true),
      ram: fractionResourceClamped(ram, fraction, true),
      disk: fractionResourceClamped(disk, fraction, true)
    };
  }, [cpu, ram, disk, fraction]);

  const price = useMemo(() => {
    const cpuTotal = (cpuFee ?? 0) * allocation.cpu;
    const ramTotal = (ramFee ?? 0) * allocation.ram;
    const diskTotal = (diskFee ?? 0) * allocation.disk;
    // GPUs are priced by the exact units selected, not the blended fraction.
    const gpuTotal = mergedGpus.reduce((sum, g) => sum + g.fee * (selectedByKey[g.key] ?? 0), 0);
    return (cpuTotal + ramTotal + diskTotal + gpuTotal) * (durationSeconds / 60);
  }, [cpuFee, allocation.cpu, allocation.ram, allocation.disk, ramFee, diskFee, mergedGpus, durationSeconds, selectedByKey]);

  return {
    mergedGpus,
    totalGpus,
    /** Independent pickable ceiling per type (its own free units). Combined picks are bounded by maxUnitsByResources. */
    maxByKey,
    /** Max COMBINED units across all types the shared CPU/RAM/disk can back right now. */
    maxUnitsByResources,
    selectedByKey,
    selectedTotal,
    allocation,
    price,
    hasGpus: totalGpus > 0,
    /** GPU env but nothing can be booked right now (all units busy, or no shared capacity to back any). */
    gpuExhausted:
      totalGpus > 0 && (maxUnitsByResources <= 0 || Object.values(maxByKey).every((n) => n <= 0)),
  };
};

export default useInferenceAllocation;
