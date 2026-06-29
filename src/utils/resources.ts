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

export type GpuAllocation = { id: string; description?: string; amount: number };

/**
 * Distribute a total GPU unit count across the given GPU resource entries, filling each entry up
 * to its currently-available capacity (max - inUse) before moving to the next, in declared order.
 * Never allocates more of an entry than is available, so the result can always be satisfied by the
 * node. Nodes with multiple physical GPUs of the same model expose one resource entry per GPU
 * (each total: 1), so this yields an even split for homogeneous boxes and a best-effort fill for
 * heterogeneous ones (the most a "pick N units" UX can do without per-type selection).
 */
export const distributeGpus = (
  total: number,
  gpus: Pick<ComputeResource, 'id' | 'description' | 'max' | 'inUse'>[],
  available?: Record<string, number>
): GpuAllocation[] => {
  if (total <= 0) return [];
  const result: GpuAllocation[] = [];
  let remaining = total;
  for (const gpu of gpus) {
    if (remaining <= 0) break;
    const capacity = available ? (available[gpu.id] ?? 0) : getAvailableAmount(gpu);
    const take = Math.min(remaining, Math.max(0, capacity));
    if (take > 0) {
      result.push({ id: gpu.id, description: gpu.description, amount: take });
      remaining -= take;
    }
  }
  return result;
};
