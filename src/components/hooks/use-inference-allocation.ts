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

/** Per-resource CPU/RAM/disk amounts (the shape both sizing modes carry). */
export type ResourceAmounts = { cpu: number; ram: number; disk: number };

/**
 * How the shared CPU/RAM/disk are sized, beyond the default GPU-fraction slice. The two modes are
 * mutually exclusive — one field replaces the former `pinnedAllocation` + `resourceFloor` pair, so
 * nothing has to enforce "at most one". Omit entirely for a pure proportional (custom-flow) slice.
 *
 *  - `pinned` (quick start): book these FIXED amounts instead of the fraction slice — a package's
 *    `recommended` resources. Still clamped to the env's min/available.
 *  - `floor` (advanced handoff from a default-models package): raise the LOWER BOUND of the fraction
 *    slice to these amounts (the package's per-resource min). Above the floor the slice stays
 *    GPU-proportional. Combined with the env's own min via max, then clamped to available.
 *
 * Each amount is always clamped to what the env can actually grant (available wins over min/floor).
 */
export type ResourceSizing =
  | ({ mode: 'pinned' } & ResourceAmounts)
  | ({ mode: 'floor' } & ResourceAmounts);

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

/**
 * Capacity ONE job can reach: the per-job `max` caps `total` when it's set lower (e.g. a free-compute
 * overlay), so fractioning the full `total` would over-derive. Used both to size the fraction slice
 * and to divide the shared budget into per-GPU-unit shares — they must agree, hence one helper.
 */
function jobCapacityOf(resource: Pick<ComputeResource, 'total' | 'max'> | undefined): number {
  const max = resource?.max ?? 0;
  const total = resource?.total && resource.total > 0 ? resource.total : max;
  return max > 0 ? Math.min(total, max) : total;
}

/**
 * Resolve one shared resource (CPU/RAM/disk) to the amount to book, clamped to the env's real
 * constraints — the same way run-job derives a package slice from a GPU pick (see select-resources.tsx).
 * `target` is the desired amount before clamping:
 *   - fraction slice → `jobCapacityOf(resource) * fraction` (proportional, the custom-flow default)
 *   - pinned         → the fixed package amount
 * `floor` raises the lower bound above the env's own `min` (the advanced-handoff package minimum);
 * omit it for pinned/plain-fraction.
 *
 * Clamping rules (shared by every mode):
 *   - Upper bound is what's currently AVAILABLE (min(total, max) − inUse), not the physical `max`:
 *     another tenant may hold part of the resource and the node rejects a serviceStart asking for
 *     more than free. Available wins over min/floor — an exhausted resource can't be met, and the
 *     card blocks selection in that case (gpuExhausted / maxUnitsByResources <= 0).
 *   - Lower bound is max(env min, floor). A floor can't over-provision past what's free (we return
 *     min(bound, available)).
 * If the resource is undefined, return 0. When rounding, a positive target never rounds to 0 — a
 * resource that exists is requested with >= 1 unit, so a small selection can't send the node an
 * amount:0 request (which it rejects / would schedule a resource-less container).
 */
function clampResource(
  resource: ComputeResource | undefined,
  target: number,
  round?: boolean,
  floor?: number
): number {
  if (!resource) {
    return 0;
  }
  let value = round ? Math.round(target) : target;
  if (round && target > 0 && value < 1) {
    value = 1;
  }
  const available = grantableAmount(resource);
  if (value > available) {
    value = available;
  }
  const min = Math.max(resource.min ?? 0, floor ?? 0);
  if (value < min) {
    return Math.min(min, available);
  }
  return value;
}

/**
 * Resolve per-type GPU units, drawing down the combined shared-resource budget in declared order so
 * the total never asks for more units than the free CPU/RAM/disk can back (per-type `maxByKey` is an
 * independent ceiling; `budget` = maxUnitsByResources caps the COMBINED pick). For each type, `pick`
 * receives that type and its budget-capped ceiling `cap` (= min(maxByKey, budget left)); return a fixed
 * unit count to honor (drawn from the budget too), or `undefined` to default that type to `cap`. Shared
 * by the hook's `selectedByKey` and the card's uncontrolled seed so both agree on the whole-env default.
 */
export function drawUnitsAcrossTypes(
  mergedGpus: MergedGpu[],
  maxByKey: Record<string, number>,
  budget: number,
  pick: (gpu: MergedGpu, cap: number) => number | undefined
): Record<string, number> {
  const result: Record<string, number> = {};
  let remaining = Math.max(0, budget);
  mergedGpus.forEach((g) => {
    // This type's free units, capped by the budget left after earlier types (remaining clamped to >= 0
    // first so a budget already spent by explicit picks can't produce a negative default).
    const cap = Math.min(maxByKey[g.key] ?? 0, Math.max(0, remaining));
    const chosen = pick(g, cap);
    const value = chosen === undefined ? cap : chosen;
    result[g.key] = value;
    remaining -= value;
  });
  return result;
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
  sizing,
  durationSeconds,
}: {
  environment: ComputeEnvironment;
  tokenAddress: string;
  /** Omit to use every unit of every type (the default, whole-environment allocation). */
  gpuSelection?: GpuSelection;
  /**
   * How to size the shared CPU/RAM/disk: `pinned` fixed amounts (quick start) or a `floor` under the
   * GPU-fraction slice (advanced handoff). Omit for a pure proportional slice (custom flow). See
   * {@link ResourceSizing}.
   */
  sizing?: ResourceSizing;
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
      // clampResource derives — dividing the full `total` would understate the share and over-count.
      const per = jobCapacityOf(resource) / totalGpus;
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
  const selectedByKey = useMemo<Record<string, number>>(
    () =>
      drawUnitsAcrossTypes(mergedGpus, maxByKey, maxUnitsByResources, (g) => {
        const requested = gpuSelection?.[g.key];
        // Explicit request → honor it, clamped only to the PHYSICAL max (not current availability): it's
        // either the card's already-capped live pick or a fixed record of a booked service, which we must
        // not under-report once other tenants fill units. undefined → fall back to the budget default.
        return requested === undefined ? undefined : Math.min(Math.max(requested, 0), g.max);
      }),
    [mergedGpus, maxByKey, maxUnitsByResources, gpuSelection]
  );

  const selectedTotal = useMemo(
    () => Object.values(selectedByKey).reduce((sum, n) => sum + n, 0),
    [selectedByKey]
  );

  const fraction = totalGpus > 0 ? selectedTotal / totalGpus : 1;

  // Size the shared CPU/RAM/disk, then clamp each to the env (clampResource). GPUs are always driven
  // by the unit selection above — only the shared resources are sized here.
  //  - `pinned` (quick start): book the package's fixed recommended amounts.
  //  - `floor` (advanced handoff) / omitted (custom flow): the GPU-fraction slice, optionally floored
  //    at the package's per-resource min.
  const allocation = useMemo(() => {
    const clamp = (resource: ComputeResource | undefined, amounts: ResourceAmounts | undefined, key: keyof ResourceAmounts) => {
      if (sizing?.mode === 'pinned') {
        return clampResource(resource, sizing[key], true);
      }
      return clampResource(resource, jobCapacityOf(resource) * fraction, true, amounts?.[key]);
    };
    const floor = sizing?.mode === 'floor' ? sizing : undefined;
    return {
      cpu: clamp(cpu, floor, 'cpu'),
      ram: clamp(ram, floor, 'ram'),
      disk: clamp(disk, floor, 'disk'),
    };
  }, [cpu, ram, disk, fraction, sizing]);

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
