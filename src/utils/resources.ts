import { ComputeResource } from '@/types/environments';

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
