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
 * Fixed CPU/RAM/disk amounts to book instead of the GPU-fraction-derived slice. Used by the
 * quick-start flow to pin a package's `recommended` resources; the custom flow leaves this undefined
 * and gets the proportional slice. Each value is still clamped to the env's min/available.
 */
export type PinnedAllocation = { cpu: number; ram: number; disk: number };

/**
 * Per-resource lower bound (custom flow, handed off from a default-models package) that raises the
 * floor of the GPU-fraction-derived slice. Unlike PinnedAllocation it does NOT force a fixed amount:
 * above the floor the slice stays GPU-proportional. Still clamped to available (available wins).
 */
export type ResourceFloor = { cpu: number; ram: number; disk: number };

/**
 * Free units the node will actually grant for a fungible resource. The node's availability gate
 * rejects a request above `total - inUse` (the env aggregate ceiling), while `max` is only the
 * per-job ceiling — so the bookable amount is bounded by the SMALLER of the two, minus what's in
 * use. Ceiling at `max - inUse` alone would let a pinned amount pass client-side and get rejected
 * at serviceStart after the escrow deposit tx (wasted gas). See ocean-node
 * checkIfResourcesAreAvailable (fungible gate: `total - inUse < amount`).
 */
function grantableAmount(resource: Pick<ComputeResource, 'total' | 'max' | 'inUse'>): number {
  const max = resource.max ?? 0;
  const total = resource.total && resource.total > 0 ? resource.total : max;
  const ceiling = Math.min(total, max);
  return Math.max(0, ceiling - (resource.inUse ?? 0));
}

/** Clamp a pinned amount into what the env can actually give: floor at `min`, ceil at free units. */
function clampPinned(resource: ComputeResource | undefined, amount: number, round?: boolean): number {
  if (!resource) {
    return 0;
  }
  let value = round ? Math.round(amount) : amount;
  const available = grantableAmount(resource);
  if (value > available) {
    value = available;
  }
  const min = resource.min ?? 0;
  if (value < min) {
    return min;
  }
  return value;
}

/**
 * Scale a resource by a fraction of the environment, then clamp to the env's real constraints —
 * the same way run-job derives a package slice from a GPU pick (see select-resources.tsx):
 *
 *  - Base the slice on the JOB-REACHABLE capacity, min(capacityOf, max), not the raw `total`. A
 *    per-job `max` below `total` (e.g. a free-compute overlay) caps what one job can request, so
 *    fractioning the full `total` would over-derive.
 *  - Upper bound is what's currently AVAILABLE (max − inUse), not the physical `max`: another tenant
 *    may hold part of the resource, and the node rejects a serviceStart that asks for more than free.
 *  - Lower bound is the env's `min`, so the slice never drops below a required minimum.
 *
 * If the resource is undefined or advertises no capacity, return 0.
 * When rounding, a positive fraction never rounds down to 0 — a resource that exists is requested
 * with at least 1 unit, so a small GPU-fraction selection can't send the node an amount:0 CPU
 * request (which the node rejects / would schedule a resource-less container).
 */
function fractionResourceClamped(
  resource: ComputeResource | undefined,
  fraction: number,
  round?: boolean,
  floor?: number
): number {
  if (!resource) {
    return 0;
  }
  // Job-reachable capacity: the per-job `max` caps `total` when it's set lower (free-compute overlay).
  const capacity = resource.total && resource.total > 0 ? resource.total : (resource.max ?? 0);
  const jobCapacity = resource.max > 0 ? Math.min(capacity, resource.max) : capacity;
  const fractionedResource = jobCapacity * fraction;
  let roundedResource = round ? Math.round(fractionedResource) : fractionedResource;
  if (round && fraction > 0 && roundedResource < 1) {
    roundedResource = 1;
  }
  // Clamp to what the node will actually grant (min(total, max) − inUse), then floor at the required
  // minimum. The available ceiling wins over min only when nothing is free — an exhausted resource
  // can't be met, and the card blocks selection in that case (gpuExhausted / maxUnitsByResources <= 0).
  const available = grantableAmount(resource);
  if (roundedResource > available) {
    roundedResource = available;
  }
  // The floor is max(env min, handoff floor): the custom flow's package handoff can raise the floor
  // above the env's own min, but never above what's free — if the floor exceeds available we return
  // available (never more), so a floor can't over-provision past what the node will grant.
  const min = Math.max(resource.min ?? 0, floor ?? 0);
  if (roundedResource < min) {
    return Math.min(min, available);
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
  pinnedAllocation,
  resourceFloor,
  durationSeconds,
}: {
  environment: ComputeEnvironment;
  tokenAddress: string;
  /** Omit to use every unit of every type (the default, whole-environment allocation). */
  gpuSelection?: GpuSelection;
  /**
   * Fixed CPU/RAM/disk to book (quick start), overriding the GPU-fraction slice. Still clamped to the
   * env's min/available. Omit (custom flow) to keep the proportional allocation.
   */
  pinnedAllocation?: PinnedAllocation;
  /**
   * Per-resource lower bound for the GPU-fraction slice (custom flow handoff from a package). Only
   * affects the non-pinned branch; each floor is combined with the env min via max, then clamped to
   * available. Omit for a pure proportional allocation.
   */
  resourceFloor?: ResourceFloor;
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
      // Per-unit share is based on JOB-REACHABLE capacity (min(total, max)), matching the slice
      // fractionResourceClamped derives — a per-job `max` below `total` caps what one job can reach,
      // so dividing the full `total` would understate the share and over-count fitting units.
      const total = resource?.total && resource.total > 0 ? resource.total : (resource?.max ?? 0);
      const jobCapacity = resource?.max && resource.max > 0 ? Math.min(total, resource.max) : total;
      const per = jobCapacity / totalGpus;
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
    // Explicit requests also draw down that budget — clamp remaining to >= 0 before each default so a
    // budget already spent by explicit picks can't produce a negative fallback allocation.
    let remaining = Math.max(0, maxUnitsByResources);
    mergedGpus.forEach((g) => {
      const requested = gpuSelection?.[g.key];
      if (requested === undefined) {
        const cap = Math.min(maxByKey[g.key] ?? 0, Math.max(0, remaining));
        result[g.key] = cap;
        remaining -= cap;
      } else {
        const value = Math.min(Math.max(requested, 0), g.max);
        result[g.key] = value;
        remaining -= value;
      }
    });
    return result;
  }, [mergedGpus, maxByKey, maxUnitsByResources, gpuSelection]);

  const selectedTotal = useMemo(
    () => Object.values(selectedByKey).reduce((sum, n) => sum + n, 0),
    [selectedByKey]
  );

  const fraction = totalGpus > 0 ? selectedTotal / totalGpus : 1;

  // Quick start pins CPU/RAM/disk to the package's recommended amounts (clamped to the env); the
  // custom flow leaves pinnedAllocation undefined and gets the GPU-fraction-derived slice. GPUs are
  // always driven by the unit selection above — only the shared resources are pinnable.
  const allocation = useMemo(() => {
    if (pinnedAllocation) {
      return {
        cpu: clampPinned(cpu, pinnedAllocation.cpu, true),
        ram: clampPinned(ram, pinnedAllocation.ram, true),
        disk: clampPinned(disk, pinnedAllocation.disk, true),
      };
    }
    return {
      cpu: fractionResourceClamped(cpu, fraction, true, resourceFloor?.cpu),
      ram: fractionResourceClamped(ram, fraction, true, resourceFloor?.ram),
      disk: fractionResourceClamped(disk, fraction, true, resourceFloor?.disk)
    };
  }, [cpu, ram, disk, fraction, pinnedAllocation, resourceFloor]);

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
