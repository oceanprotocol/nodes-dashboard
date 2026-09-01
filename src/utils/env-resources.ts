import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { ComputeEnvironment } from '@/types/environments';
import { getAvailableAmount } from '@/utils/resources';

/**
 * Resource math shared by the flows that auto-match an environment to a declared requirement set —
 * quick-start packages (`ResourceRequirement`) and app templates (`TemplateResourceRequirement`). Both
 * shapes fit {@link DeclaredRequirement}, so the helpers below work for either.
 */

/**
 * Description the node stamps on the compute environment it generates for the benchmark runner. Not a
 * flag — the node exposes no other marker, and the benchmark env shares its sibling's `id`, so the
 * string is the only thing that tells them apart. Kept in sync with the node-config editor, which
 * matches the same text to render that env read-only.
 */
export const BENCHMARK_ENV_DESCRIPTION = 'Auto-generated benchmark environment';

/**
 * The node's own benchmarking environment, which must never be offered as a launch target: it exists
 * so the incentives benchmark has somewhere to run, and booking it competes with the measurement the
 * node's rewards depend on. It advertises `features.services` and a paid fee token like any other env,
 * so nothing else in the bookability checks excludes it.
 */
export function isBenchmarkEnv(environment: ComputeEnvironment): boolean {
  return environment.description === BENCHMARK_ENV_DESCRIPTION;
}

/** A declared resource floor: `cpu`/`ram`/`disk` by id, or GPU units by `type: 'gpu'`. */
export type DeclaredRequirement = {
  id?: string;
  type?: string;
  min: number;
  recommended?: number;
};

/** Units of a fungible/GPU resource the env can hand ONE job right now: min(max, total − inUse),
 *  the node's own gate. Single definition in @/utils/resources so every flow agrees. */
export const grantable = getAvailableAmount;

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
 * GPU `description` (what the allocation hook / buildGpuRequests match on).
 *
 * EVERY type in the env gets an explicit number, zero included. The allocation hook reads the
 * selection per type and defaults a MISSING key to every free unit of that type, so any type left out
 * of the record is silently booked in full — `{}` on an 8-GPU env books all eight and prices them.
 *
 * A package/template that declares no GPU (or a zero one) still takes ONE unit: a GPU env is sold in
 * unit-sized slices and the card blocks a zero pick ('Select at least one GPU unit to continue').
 */
export function autoGpuSelection(environment: ComputeEnvironment, required: DeclaredRequirement[]): GpuSelection {
  const gpuResources = (environment.resources ?? []).filter((r) => r.type === 'gpu');
  const selection: GpuSelection = {};
  gpuResources.forEach((r) => {
    selection[r.description || 'GPU'] = 0;
  });

  const gpuReq = required.find((r) => r.type === 'gpu');
  const target = gpuReq ? Math.min(gpuReq.recommended ?? gpuReq.min, grantableByType(environment, 'gpu')) : 1;
  // Draw the target across GPU types in declared order (units free per type), each keyed by its
  // description so units of one type merge under one key. A type with nothing free takes 0 and the
  // draw moves on, so the single no-GPU unit lands on the first type that can actually give one.
  let remaining = Math.max(target, 1);
  gpuResources.forEach((r) => {
    if (remaining <= 0) {
      return;
    }
    const key = r.description || 'GPU';
    const take = Math.min(grantable(r), remaining);
    selection[key] += take;
    remaining -= take;
  });
  return selection;
}
