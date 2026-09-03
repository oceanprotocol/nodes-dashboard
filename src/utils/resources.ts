import { ComputeResource } from '@/types/environments';

/**
 * Amount of a compute resource currently available for a new job: `min(max, total - inUse)`, the two
 * ceilings the node enforces separately.
 *  - `total - inUse` is the env aggregate ceiling (checkIfResourcesAreAvailable, gate 1:
 *    `total - inUse < amount` → reject). It applies to FUNGIBLE resources only — discrete ones (GPUs)
 *    are gated against the engine-wide pool instead (checkGlobalResourceAvailability), which reaches
 *    the same number in practice because a discrete resource's `inUse` is already aggregated across
 *    every env.
 *  - `max` is the separate PER-JOB ceiling (checkAndFillMissingResources: `desired > max` → reject).
 * Both must hold, so the bookable amount is the smaller of the two. Computing it as
 * `min(total, max) - inUse` instead (the old convention) under-reports whenever `max < total`: an
 * env with 16 cores, an 8-core per-job cap and 4 in use can still grant a full 8, not 4 — and
 * under-reporting there strands free GPUs that nothing can be booked against.
 * Clamped to >= 0 so a fully (or over-) consumed resource reports 0.
 *
 * ABSENT vs ZERO `total` are deliberately not the same thing here:
 *  - ABSENT → fall back to `max`. Current nodes always stamp `total` (cpu/ram/disk from sysinfo,
 *    discrete resources from config), but the env list is served from the incentive-backend's cached
 *    `/envs` snapshot, which can still hold entries produced by node builds predating that. Denying
 *    those would show a healthy environment as fully consumed and make it unbookable.
 *  - ZERO → 0, no fallback. An explicit `total: 0` is what the node itself acts on, and it is
 *    reachable from ordinary config: `resolveEnvironmentResources` only recomputes `max` when the env
 *    ref sets one, so a ref carrying `total: 0` and no `max` yields `{ total: 0, max: <pool max> }`.
 *    The node then denies at gate 1 (`0 - inUse < amount`) while a `total → max` fallback would
 *    advertise the whole pool as free — and the rejection would land at serviceStart, after the
 *    escrow deposit tx.
 *
 * `capacityOf` / the allocation hook's `jobCapacityOf` still collapse both cases to `max`. That stays
 * harmless because every amount they size is clamped through this function last, so an explicit zero
 * still ends up at 0.
 */
export const getAvailableAmount = (resource?: { total?: number; max?: number; inUse?: number }): number => {
  if (!resource) {
    return 0;
  }
  const max = resource.max ?? 0;
  const total = resource.total ?? max;
  return Math.max(0, Math.min(max, total - (resource.inUse ?? 0)));
};

export const capacityOf = (resource?: Pick<ComputeResource, 'total' | 'max'>): number => {
  const total = resource?.total ?? 0;
  return total > 0 ? total : (resource?.max ?? 0);
};

/**
 * `resourceId -> description` for an environment's resources (e.g. `gpu2` -> "NVIDIA RTX 4090", `cpu`
 * -> "Intel Xeon Platinum 8480+"). Runtime metrics snapshots only carry opaque ids, so this is what
 * turns them into hardware names in the resource usage panel. Resources without a description are
 * omitted, leaving callers to fall back to the id.
 */
export const resourceDescriptionsById = (resources?: ComputeResource[]): Record<string, string> => {
  const names: Record<string, string> = {};
  (resources ?? []).forEach((resource) => {
    if (resource.description) {
      names[String(resource.id)] = resource.description;
    }
  });
  return names;
};
