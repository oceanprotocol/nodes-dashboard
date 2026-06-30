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
