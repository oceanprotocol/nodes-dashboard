import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { ComputeEnvironment, ComputeResource } from '@/types/environments';

/**
 * Resource math shared by the flows that auto-match an environment to a declared requirement set —
 * quick-start packages (`ResourceRequirement`) and app templates (`TemplateResourceRequirement`). Both
 * shapes fit {@link DeclaredRequirement}, so the helpers below work for either.
 */

/** A declared resource floor: `cpu`/`ram`/`disk` by id, or GPU units by `type: 'gpu'`. */
export type DeclaredRequirement = {
  id?: string;
  type?: string;
  min: number;
  recommended?: number;
};

/** Units of a fungible/GPU resource the env can hand ONE job right now: min(total, max) − inUse,
 *  mirroring the allocation hook's grantableAmount. */
export function grantable(resource: Pick<ComputeResource, 'total' | 'max' | 'inUse'>): number {
  const max = resource.max ?? 0;
  const total = resource.total && resource.total > 0 ? resource.total : max;
  return Math.max(0, Math.min(total, max) - (resource.inUse ?? 0));
}

/** Sum grantable units across every resource of a `type` (e.g. all GPUs). */
export function grantableByType(environment: ComputeEnvironment, type: string): number {
  return (environment.resources ?? [])
    .filter((r) => r.type === type)
    .reduce((sum, r) => sum + grantable(r), 0);
}

/** Grantable amount for a single continuous resource by id (cpu/ram/disk). */
export function grantableById(environment: ComputeEnvironment, id: string): number {
  const resource = (environment.resources ?? []).find((r) => r.id === id);
  return resource ? grantable(resource) : 0;
}

/**
 * Whether an env can currently satisfy every declared floor (`min`). GPU requirements (`type: 'gpu'`)
 * are summed across all GPU resources; cpu/ram/disk are matched by id. An env that can't meet a floor
 * is hidden from the picker — it can't launch the package/template.
 */
export function meetsMinResources(environment: ComputeEnvironment, required: DeclaredRequirement[]): boolean {
  return required.every((req) => {
    const available = req.type === 'gpu' ? grantableByType(environment, 'gpu') : grantableById(environment, req.id ?? '');
    return available >= req.min;
  });
}

/**
 * Auto GPU selection for a read-only card: book the recommended GPU count when the env has that many
 * units free, else fall back to the declared min (guaranteed by {@link meetsMinResources}). Keyed by
 * GPU `description` (what the allocation hook / buildGpuRequests match on). Empty when GPU-less.
 */
export function autoGpuSelection(environment: ComputeEnvironment, required: DeclaredRequirement[]): GpuSelection {
  const gpuReq = required.find((r) => r.type === 'gpu');
  if (!gpuReq) {
    return {};
  }
  const selection: GpuSelection = {};
  let remaining = Math.min(gpuReq.recommended ?? gpuReq.min, grantableByType(environment, 'gpu'));
  // Draw the target across GPU types in declared order (units free per type), each keyed by its
  // description so units of one type merge under one key.
  (environment.resources ?? [])
    .filter((r) => r.type === 'gpu')
    .forEach((r) => {
      if (remaining <= 0) {
        return;
      }
      const key = r.description || 'GPU';
      const take = Math.min(grantable(r), remaining);
      selection[key] = (selection[key] ?? 0) + take;
      remaining -= take;
    });
  return selection;
}
