import { ComputeResource } from '@/types/environments';

/**
 * Amount of a compute resource currently available for a new job.
 * Convention used across the app: available = max (per-job ceiling) - inUse (currently consumed).
 * Clamped to >= 0 so a fully (or over-) consumed resource reports 0.
 */
export const getAvailableAmount = (resource?: Pick<ComputeResource, 'max' | 'inUse'>): number => {
  if (!resource) {
    return 0;
  }
  return Math.max(0, (resource.max ?? 0) - (resource.inUse ?? 0));
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
