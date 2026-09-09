import useEnvResources from '@/components/hooks/use-env-resources';
import { ComputeEnvironment, ComputeResource as LocalComputeResource } from '@/types/environments';
import {
  BoundsMap,
  constraintError,
  deriveBounds,
  isSelectionValid,
  resolveConstraints,
  ResourceRequest,
} from '@/utils/constraints';
import { billableMinutes } from '@/utils/duration';
import { getAvailableAmount } from '@/utils/resources';
import { serviceDurationBounds } from '@/utils/service-duration';
import { ComputeResource } from '@oceanprotocol/lib';
import { useMemo } from 'react';

export type MergedGpu = {
  /** Key used to address this type in the selection map (description, or a synthetic fallback). */
  key: string;
  description?: string;
  /** Total units of this type the environment advertises (the physical ceiling). */
  max: number;
  /** Units of this type actually free right now (getAvailableAmount). The pickable ceiling. */
  available: number;
  /** Per-unit fee for this type (units of one description share a fee — the first id's). */
  fee: number;
  /**
   * Whether the env itself tolerates booking NONE of this type — true only when every resource id
   * merged into it declares `min: 0`. The env's own floor, distinct from a template/package's declared
   * min. Live envs stamp `min: 0` on every GPU device id, so this is true today, but it's read (not
   * assumed) wherever zero-GPU picks are gated: an env that actually requires at least one unit of a
   * type must keep blocking a zero pick even when the launch target allows one.
   *
   * A boolean rather than a summed `min`, which would read like a clamp bound without being one — 8
   * devices at `min: 1` sum to 8, while the floor for the group is 1.
   */
  allowsZero: boolean;
};

/** How many units of each GPU type (keyed by MergedGpu.key) the user wants to use. */
export type GpuSelection = Record<string, number>;

/** Per-resource CPU/RAM/disk amounts (the shape both sizing modes carry). */
export type ResourceAmounts = { cpu: number; ram: number; disk: number };

const clampNum = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * How the shared CPU/RAM/disk are sized, beyond the default GPU-fraction slice. The modes are
 * mutually exclusive — one field replaces the former `pinnedAllocation` + `resourceFloor` pair, so
 * nothing has to enforce "at most one". Omit entirely for a pure proportional (custom-flow) slice.
 *
 *  - `pinned` (quick start): book these FIXED amounts instead of the fraction slice — a package's
 *    `recommended` resources. Still clamped to the env's min/available, and floored at `floor` (the
 *    package's per-resource min) when set: the effective lower bound is `max(envMin, packageMin)`, so a
 *    constraint ceiling can't trim the pinned amount below what the model needs.
 *  - `floor` (advanced handoff from a default-models package): raise the LOWER BOUND of the fraction
 *    slice to these amounts (the package's per-resource min). Above the floor the slice stays
 *    GPU-proportional. Combined with the env's own min via max, then clamped to available.
 *  - `exact` (already-booked service): the amounts the node records for a RUNNING service, reported
 *    verbatim — see the allocation memo for why nothing clamps them.
 *
 * `pinned`/`floor` amounts are always clamped to what the env can actually grant (available wins over
 * min/floor); `exact` is the one mode that isn't clamped.
 */
export type ResourceSizing =
  | ({ mode: 'pinned'; floor?: ResourceAmounts } & ResourceAmounts)
  | ({ mode: 'floor' } & ResourceAmounts)
  | ({ mode: 'exact' } & ResourceAmounts);

/**
 * Free units the node will actually grant for a fungible resource: `min(max, total - inUse)` — the
 * env aggregate gate (`total - inUse < amount` → reject) AND the per-job `max` ceiling must both
 * hold. Aliased to the shared helper so every flow uses one definition; see @/utils/resources.
 */
const grantableAmount = getAvailableAmount;

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
 * The proportional slice of a shared resource for `units` out of `totalGpus`, FLOORED to a whole
 * amount.
 *
 * Flooring (rather than rounding) is what keeps the last free GPU bookable. `Math.round` lets a
 * slice claim MORE than its share — 7 cores over 2 GPUs rounds 3.5 up to 4 — so the first booking
 * eats into the second's share and the remaining 3 cores no longer cover a "slice"; the unit budget
 * then floors to 0 and the free GPU can't be selected at all. Flooring is subadditive here
 * (`sum of floor(cap·uᵢ/T) <= cap` whenever `sum uᵢ <= T`), so slices of disjoint unit picks can
 * never overrun capacity and every free unit stays bookable — at the cost of leaving at most T−1
 * units of a resource unallocated.
 *
 * A resource that exists is never sliced to 0 (the node rejects an amount:0 request), and an env
 * with no GPUs isn't fractioned at all — it's booked whole.
 */
function sliceFor(
  resource: Pick<ComputeResource, 'total' | 'max'> | undefined,
  units: number,
  totalGpus: number
): number {
  const capacity = jobCapacityOf(resource);
  if (capacity <= 0) {
    return 0;
  }
  if (totalGpus <= 0) {
    return capacity;
  }
  if (units <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor((capacity * units) / totalGpus));
}

/**
 * Resolve one shared resource (CPU/RAM/disk) to the amount to book, clamped to the env's real
 * constraints — the same way run-job derives a package slice from a GPU pick (see select-resources.tsx).
 * `target` is the desired amount before clamping:
 *   - fraction slice → `sliceFor(resource, units, totalGpus)` (proportional, the custom-flow default)
 *   - pinned         → the fixed package amount
 * `floor` raises the lower bound above the env's own `min` (the advanced-handoff package minimum);
 * omit it for pinned/plain-fraction.
 *
 * Clamping rules (shared by every mode):
 *   - Upper bound is what's currently AVAILABLE (min(max, total − inUse)), not the physical `max`:
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

/** Collapse a list of per-unit GPU ids into `{ id, amount }` requests, the shape the node reads. */
function toGpuRequests(unitIds: string[]): ResourceRequest[] {
  const amounts = new Map<string, number>();
  unitIds.forEach((id) => amounts.set(id, (amounts.get(id) ?? 0) + 1));
  return [...amounts].map(([id, amount]) => ({ id, amount }));
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
 * are capped at that type's free units (min(max, total − inUse)), and the overall unit count is further capped so
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
   * How to size the shared CPU/RAM/disk: `pinned` fixed amounts (quick start), a `floor` under the
   * GPU-fraction slice (advanced handoff), or the `exact` amounts a running service already booked.
   * Omit for a pure proportional slice (custom flow). See {@link ResourceSizing}.
   */
  sizing?: ResourceSizing;
  durationSeconds: number;
}) => {
  const {
    cpu,
    cpuAvailable,
    cpuFee,
    disk,
    diskAvailable,
    diskFee,
    gpus,
    gpusAvailable,
    gpuFees,
    ram,
    ramAvailable,
    ramFee,
  } = useEnvResources({
    environment,
    freeCompute: false,
    tokenAddress,
  });

  /**
   * Merge units of the same description into one type, summing both the physical ceiling (max) and the
   * units currently free (gpusAvailable, i.e. min(max, total − inUse)) across every id of that type. The fee is the
   * first id's — units of one description share a fee, so no averaging needed.
   */
  const mergedGpus = useMemo<MergedGpu[]>(() => {
    return gpus.reduce((merged, gpu) => {
      const key = gpu.description || 'GPU';
      const existing = merged.find((g) => g.key === key);
      if (existing) {
        existing.max += gpu.max ?? 0;
        existing.available += gpusAvailable[gpu.id] ?? 0;
        existing.allowsZero = existing.allowsZero && (gpu.min ?? 0) <= 0;
      } else {
        merged.push({
          key,
          description: gpu.description,
          max: gpu.max ?? 0,
          available: gpusAvailable[gpu.id] ?? 0,
          fee: gpuFees[gpu.id] ?? 0,
          allowsZero: (gpu.min ?? 0) <= 0,
        });
      }
      return merged;
    }, [] as MergedGpu[]);
  }, [gpus, gpusAvailable, gpuFees]);

  const totalGpus = useMemo(() => mergedGpus.reduce((sum, g) => sum + g.max, 0), [mergedGpus]);

  // ── Cross-resource constraint enforcement, shared with the run-job flow. ──────────────────────
  // Envs on the same fleet advertise the same `constraints[]` (ratio / floor / aggregate / type-group);
  // the node rejects a serviceStart that violates them AFTER the escrow deposit, so we mirror the check
  // client-side, reusing @/utils/constraints on the identical ComputeResource[] the node publishes.
  // When an env carries no constraints, every helper here short-circuits to the plain availability
  // envelope, so behaviour is then identical to the previous proportional-slice-only logic.
  const cpuId = cpu?.id ?? 'cpu';
  const ramId = ram?.id ?? 'ram';
  const diskId = disk?.id ?? 'disk';

  // Every resource that participates in constraint math, each `max` narrowed to what's currently
  // AVAILABLE (min(max, total − inUse)) — a raised floor can then never exceed what a job could actually get.
  // env-resources yields the @/types ComputeResource shape; the hook's other math uses the
  // structurally-identical @oceanprotocol/lib alias, hence the cast.
  const availResources = useMemo<LocalComputeResource[]>(() => {
    const list = [cpu, ram, disk, ...gpus].filter(Boolean) as ComputeResource[];
    return list.map((r) => ({ ...r, max: getAvailableAmount(r) }) as unknown as LocalComputeResource);
  }, [cpu, ram, disk, gpus]);

  // The package's per-resource min (both sizing modes carry it): `floor` amounts for pinned, the
  // amounts themselves for floor mode. Folded into baseBounds.min below so the effective lower bound
  // is max(envMin, packageMin) EVERYWHERE the constraint model reads it — a constraint ceiling can't
  // trim a resource below what the model needs. undefined for a plain custom-flow slice.
  const packageFloor: ResourceAmounts | undefined =
    sizing?.mode === 'pinned' ? sizing.floor : sizing?.mode === 'floor' ? sizing : undefined;

  // Availability envelope per resource before cross-resource constraints narrow it further. Lower
  // bound = max(env min, package min), capped at available (a floor can't demand more than is free).
  const baseBounds = useMemo<BoundsMap>(() => {
    const lower = (envMin: number | undefined, pkgMin: number | undefined, available: number) =>
      Math.min(Math.max(envMin ?? 0, pkgMin ?? 0), available);
    const b: BoundsMap = {
      [cpuId]: { min: lower(cpu?.min, packageFloor?.cpu, cpuAvailable), max: Math.max(cpu?.min ?? 0, cpuAvailable) },
      [ramId]: { min: lower(ram?.min, packageFloor?.ram, ramAvailable), max: Math.max(ram?.min ?? 0, ramAvailable) },
      [diskId]: { min: lower(disk?.min, packageFloor?.disk, diskAvailable), max: Math.max(disk?.min ?? 0, diskAvailable) },
    };
    gpus.forEach((gpu) => {
      b[gpu.id] = { min: 0, max: gpusAvailable[gpu.id] ?? 0 };
    });
    return b;
  }, [cpuId, ramId, diskId, cpu, ram, disk, cpuAvailable, ramAvailable, diskAvailable, gpus, gpusAvailable, packageFloor]);

  // One entry per FREE GPU UNIT, in declared order — the unit-cap loop and the per-selection id
  // mapping both draw from this, so a chosen unit count maps deterministically onto ids. An id is
  // repeated once per free unit: a POOLED id (one resource advertising several units, which
  // buildGpuRequests already handles by sending `amount: N`) would otherwise count as a single unit
  // here and cap the whole selection at one GPU, leaving the rest of the pool unselectable.
  const orderedFreeGpuUnits = useMemo(
    () => gpus.flatMap((r) => Array.from({ length: gpusAvailable[r.id] ?? 0 }, () => r.id)),
    [gpus, gpusAvailable]
  );

  /**
   * Bound how many GPU units the free CPU/RAM/disk can actually back: another tenant can leave GPUs
   * free but too little shared capacity to run them, so this can be lower than the count of free GPU
   * units. No-GPU envs are one whole unit.
   *
   * Asks the question the allocation itself answers — "what would a `u`-unit pick REQUEST, and is
   * that much free?" — instead of dividing availability by an idealised per-unit share. Two things
   * that division got wrong, both leaving a free GPU unselectable:
   *  - it demanded a full ROUNDED share per unit, so any capacity that doesn't divide evenly across
   *    the GPUs (7 cores over 2) made the last unit look unaffordable (see sliceFor);
   *  - it applied to `pinned` sizing too, where the booked amounts are FIXED and don't scale with
   *    units at all — a quick-start package that comfortably fits was still rejected.
   * Largest feasible `u` wins, so the search runs downwards from the full unit count.
   */
  const maxUnitsByResources = useMemo(() => {
    if (totalGpus <= 0) {
      return 1;
    }
    const shared: [ComputeResource | undefined, number, keyof ResourceAmounts][] = [
      [cpu, cpuAvailable, 'cpu'],
      [ram, ramAvailable, 'ram'],
      [disk, diskAvailable, 'disk'],
    ];
    // What a `units` pick would ask the node for, before availability clamps it: the pinned amount
    // (fixed) or the floored proportional slice, raised to the env min and the package floor.
    const needed = (resource: ComputeResource | undefined, key: keyof ResourceAmounts, units: number) => {
      const target = sizing?.mode === 'pinned' ? Math.round(sizing[key]) : sliceFor(resource, units, totalGpus);
      return Math.max(target, resource?.min ?? 0, packageFloor?.[key] ?? 0);
    };
    for (let u = totalGpus; u >= 1; u--) {
      if (shared.every(([resource, available, key]) => !resource || needed(resource, key, u) <= available)) {
        return u;
      }
    }
    return 0;
  }, [totalGpus, cpu, cpuAvailable, ram, ramAvailable, disk, diskAvailable, sizing, packageFloor]);

  // Constraint-aware GPU unit cap: the largest whole unit count whose CPU/RAM/disk amounts — sized by the
  // active sizing mode and clamped into the constraint envelope exactly as `allocation` builds them —
  // still satisfies every
  // constraint within availability. Mirrors run-job's maxUnitsByConstraints. No GPUs / no constraints →
  // unbounded (the resource cap governs). Must clamp before validating: a raw proportional slice can
  // exceed a constraint ceiling that the real derivation trims.
  const maxUnitsByConstraints = useMemo(() => {
    if (totalGpus <= 0 || orderedFreeGpuUnits.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    // Same sizing-mode branches `allocation` books with: a pinned package's amounts are FIXED and don't
    // scale with units, and a floor package raises the slice to its per-resource min. Validating a bare
    // proportional slice instead tests a selection the flow never requests, and rejects free GPU units a
    // pinned package comfortably fits (the same bug maxUnitsByResources guards against).
    const floorAmounts = sizing?.mode === 'floor' ? sizing : undefined;
    const rawFor = (resource: ComputeResource | undefined, key: keyof ResourceAmounts, units: number) => {
      if (sizing?.mode === 'pinned') {
        return clampResource(resource, sizing[key], true, sizing.floor?.[key]);
      }
      return clampResource(resource, sliceFor(resource, units, totalGpus), true, floorAmounts?.[key]);
    };
    let feasible = 0;
    for (let u = 1; u <= orderedFreeGpuUnits.length; u++) {
      const gpuSel = toGpuRequests(orderedFreeGpuUnits.slice(0, u));
      const rawCpu = rawFor(cpu, 'cpu', u);
      const rawRam = rawFor(ram, 'ram', u);
      const rawDisk = rawFor(disk, 'disk', u);
      const b = deriveBounds(
        availResources,
        { [cpuId]: rawCpu, [ramId]: rawRam, [diskId]: rawDisk, ...Object.fromEntries(gpuSel.map((g) => [g.id, g.amount])) },
        baseBounds
      );
      const cb = b[cpuId] ?? { min: 0, max: rawCpu };
      const rb = b[ramId] ?? { min: 0, max: rawRam };
      const db = b[diskId] ?? { min: 0, max: rawDisk };
      const sel: ResourceRequest[] = [
        { id: cpuId, amount: clampNum(rawCpu, cb.min, cb.max) },
        { id: ramId, amount: clampNum(rawRam, rb.min, rb.max) },
        { id: diskId, amount: clampNum(rawDisk, db.min, db.max) },
        ...gpuSel,
      ];
      if (!isSelectionValid(availResources, sel)) {
        break;
      }
      feasible = u;
    }
    return feasible;
  }, [totalGpus, orderedFreeGpuUnits, cpu, ram, disk, sizing, availResources, baseBounds, cpuId, ramId, diskId]);

  // Combined budget for the COMBINED unit selection: shared-resource fit AND constraint feasibility.
  const unitBudget = Math.min(maxUnitsByResources, maxUnitsByConstraints);

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
      drawUnitsAcrossTypes(mergedGpus, maxByKey, unitBudget, (g) => {
        const requested = gpuSelection?.[g.key];
        // Explicit request → honor it, clamped only to the PHYSICAL max (not current availability): it's
        // either the card's already-capped live pick or a fixed record of a booked service, which we must
        // not under-report once other tenants fill units. undefined → fall back to the budget default.
        return requested === undefined ? undefined : Math.min(Math.max(requested, 0), g.max);
      }),
    [mergedGpus, maxByKey, unitBudget, gpuSelection]
  );

  const selectedTotal = useMemo(
    () => Object.values(selectedByKey).reduce((sum, n) => sum + n, 0),
    [selectedByKey]
  );

  // Concrete GPU-id requests for the current selection. `selectedByKey` is keyed by description; map
  // each description's count onto its first-N available resource ids (declared order), so the request
  // the constraint model sees uses the same ids the node keys constraints on.
  const gpuIdRequests = useMemo<ResourceRequest[]>(() => {
    const requests: ResourceRequest[] = [];
    mergedGpus.forEach((g) => {
      const count = selectedByKey[g.key] ?? 0;
      if (count <= 0) {
        return;
      }
      // Draw `count` free UNITS of this type (an id repeated once per free unit), then collapse them
      // into per-id amounts — the same draw buildGpuRequests performs when it builds the real request.
      const unitsOfType = orderedFreeGpuUnits.filter(
        (id) => (gpus.find((r) => r.id === id)?.description || 'GPU') === g.key
      );
      requests.push(...toGpuRequests(unitsOfType.slice(0, count)));
    });
    return requests;
  }, [mergedGpus, selectedByKey, gpus, orderedFreeGpuUnits]);

  // Size the shared CPU/RAM/disk, then clamp each to the env, then settle cross-resource constraints.
  // GPUs are always driven by the unit selection above — only the shared resources are sized here.
  //  - `pinned` (quick start): book the package's fixed recommended amounts.
  //  - `floor` (advanced handoff) / omitted (custom flow): the GPU-fraction slice, optionally floored
  //    at the package's per-resource min.
  // The raw slice is then run through deriveBounds + resolveConstraints (same as run-job package mode)
  // so constraint floors are raised and ceilings capped; with no constraints this is a no-op.
  const allocation = useMemo(() => {
    // Already-booked service: report exactly what the node recorded. Nothing is clamped here —
    // the running service's own usage is part of every resource's `inUse`, so clamping to what's
    // still AVAILABLE would under-report the amounts it actually holds (same reasoning as the
    // explicit GPU pick in `selectedByKey`) — and the constraint pass is moot: the node already
    // accepted this exact request when the service started.
    if (sizing?.mode === 'exact') {
      return { cpu: sizing.cpu, ram: sizing.ram, disk: sizing.disk };
    }
    const clampSlice = (
      resource: ComputeResource | undefined,
      amounts: ResourceAmounts | undefined,
      key: keyof ResourceAmounts
    ) => {
      if (sizing?.mode === 'pinned') {
        // Book the recommended (pinned) amount, floored at the package min so the effective lower bound
        // is max(envMin, packageMin) — the more aggressive of the two. Available still wins on top.
        return clampResource(resource, sizing[key], true, sizing.floor?.[key]);
      }
      return clampResource(resource, sliceFor(resource, selectedTotal, totalGpus), true, amounts?.[key]);
    };
    const floor = sizing?.mode === 'floor' ? sizing : undefined;
    const rawCpu = clampSlice(cpu, floor, 'cpu');
    const rawRam = clampSlice(ram, floor, 'ram');
    const rawDisk = clampSlice(disk, floor, 'disk');

    // No GPUs selected → constraints keyed on a GPU parent don't apply; return the plain slice.
    // (Also the fast path for constraint-less envs where the bound derivation is an identity.)
    const gpuSel = Object.fromEntries(gpuIdRequests.map((g) => [g.id, g.amount]));
    const pkgBounds = deriveBounds(
      availResources,
      { [cpuId]: rawCpu, [ramId]: rawRam, [diskId]: rawDisk, ...gpuSel },
      baseBounds
    );
    const cb = pkgBounds[cpuId] ?? { min: 0, max: rawCpu };
    const rb = pkgBounds[ramId] ?? { min: 0, max: rawRam };
    const db = pkgBounds[diskId] ?? { min: 0, max: rawDisk };
    let sel: ResourceRequest[] = [
      { id: cpuId, amount: clampNum(rawCpu, cb.min, cb.max) },
      { id: ramId, amount: clampNum(rawRam, rb.min, rb.max) },
      { id: diskId, amount: clampNum(rawDisk, db.min, db.max) },
      ...gpuIdRequests,
    ];
    try {
      // Settle any remaining floors (aggregate / type-group) the per-resource bounds don't cover.
      sel = resolveConstraints(availResources, sel);
    } catch {
      // Infeasible at this selection — the unit cap (maxUnitsByConstraints) prevents reaching it, and
      // constraintViolation blocks Continue if one is somehow selected. Fall back to the clamped slice.
    }
    const amount = (id: string, fallback: number) => sel.find((r) => r.id === id)?.amount ?? fallback;
    return {
      cpu: clampNum(amount(cpuId, rawCpu), cb.min, cb.max),
      ram: clampNum(amount(ramId, rawRam), rb.min, rb.max),
      disk: clampNum(amount(diskId, rawDisk), db.min, db.max),
    };
  }, [cpu, ram, disk, selectedTotal, totalGpus, sizing, gpuIdRequests, availResources, baseBounds, cpuId, ramId, diskId]);

  // The exact request the node would receive, checked against the full constraint model (covers
  // type-group / aggregate cases per-resource bounds can't express). Null when the node would accept.
  // Skipped for `exact` sizing: that's a service the node already accepted and provisioned, so it's
  // read-only here — and re-validating it against the CURRENT availability envelope (which counts the
  // service's own usage as `inUse`) would report a violation for a perfectly live service.
  const constraintViolation = useMemo<string | null>(
    () =>
      sizing?.mode === 'exact'
        ? null
        : constraintError(availResources, [
            { id: cpuId, amount: allocation.cpu },
            { id: ramId, amount: allocation.ram },
            { id: diskId, amount: allocation.disk },
            ...gpuIdRequests,
          ]),
    [sizing?.mode, availResources, cpuId, ramId, diskId, allocation, gpuIdRequests]
  );

  const price = useMemo(() => {
    const cpuTotal = (cpuFee ?? 0) * allocation.cpu;
    const ramTotal = (ramFee ?? 0) * allocation.ram;
    const diskTotal = (diskFee ?? 0) * allocation.disk;
    // GPUs are priced by the exact units selected, not the blended fraction.
    const gpuTotal = mergedGpus.reduce((sum, g) => sum + g.fee * (selectedByKey[g.key] ?? 0), 0);
    // Whole billable minutes, floored at the env's SERVICE minimum — the node's own formula. This is
    // the floor calculateResourcesCost applies to a service (minJobDuration governs compute jobs), so
    // quoting against the wrong one under-quotes and the escrow deposit sized from that quote is too
    // small for the node's createLock ("does not have enough funds"). See billableMinutes.
    const { min: serviceMinSeconds } = serviceDurationBounds(environment);
    return (cpuTotal + ramTotal + diskTotal + gpuTotal) * billableMinutes(durationSeconds, serviceMinSeconds);
  }, [
    cpuFee,
    allocation.cpu,
    allocation.ram,
    allocation.disk,
    ramFee,
    diskFee,
    mergedGpus,
    durationSeconds,
    environment,
    selectedByKey,
  ]);

  return {
    mergedGpus,
    totalGpus,
    /** Independent pickable ceiling per type (its own free units). Combined picks are bounded by unitBudget. */
    maxByKey,
    /**
     * Max COMBINED units across all types that can currently be booked: the smaller of what the shared
     * CPU/RAM/disk can back and what cross-resource constraints allow. Drives the chip disable rules.
     */
    maxUnitsByResources: unitBudget,
    selectedByKey,
    selectedTotal,
    allocation,
    price,
    /** Constraint violation message for the current selection, or null when the node would accept it. */
    constraintViolation,
    hasGpus: totalGpus > 0,
    /** GPU env but nothing can be booked right now (all units busy, or no shared capacity to back any). */
    gpuExhausted: totalGpus > 0 && (unitBudget <= 0 || Object.values(maxByKey).every((n) => n <= 0)),
  };
};

export default useInferenceAllocation;
