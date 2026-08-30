import { ComputeResource } from '@/types/environments';

/**
 * Amount of a compute resource currently available for a new job — mirroring the node's own gate
 * exactly: `min(max, total - inUse)`.
 *  - `total - inUse` is the env aggregate ceiling the node checks (checkIfResourcesAreAvailable,
 *    gate 1: `total - inUse < amount` → reject).
 *  - `max` is the separate PER-JOB ceiling (checkAndFillMissingResources: `desired > max` → reject).
 * Both must hold, so the bookable amount is the smaller of the two. Computing it as
 * `min(total, max) - inUse` instead (the old convention) under-reports whenever `max < total`: an
 * env with 16 cores, an 8-core per-job cap and 4 in use can still grant a full 8, not 4 — and
 * under-reporting there strands free GPUs that nothing can be booked against.
 * Clamped to >= 0 so a fully (or over-) consumed resource reports 0.
 */
export const getAvailableAmount = (resource?: {
  total?: number;
  max?: number;
  inUse?: number;
}): number => {
  if (!resource) {
    return 0;
  }
  const max = resource.max ?? 0;
  const total = resource.total && resource.total > 0 ? resource.total : max;
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
