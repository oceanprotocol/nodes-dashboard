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
  /** Discrete (whole-unit, e.g. GPU) vs fungible (continuous, e.g. cpu/ram/disk). Carried by real
   *  template/package data; not matched on — every consumer here keys off `type`/`id` instead. */
  kind?: 'discrete' | 'fungible';
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
 * Auto GPU selection for a read-only card: book {@link preferredGpuOption} of
 * {@link declaredGpuOptions} — the biggest count the publisher declared — drawn across GPU types
 * (keyed by `description`, what the allocation hook / buildGpuRequests match on) in declared order.
 * The declared count is a total, so it is drawn down rather than applied per type; see the note at the
 * draw below for the over-booking this avoids on a multi-description env.
 *
 * Same VALUE the editable card (inference-environment-card) preselects for a single-type env, which is
 * every live env today: a package/template's static read-only card (this) and the Advanced picker's
 * editable one must not disagree on the default, or switching between them looks like the pick
 * silently changed. See declaredGpuOptions for the clamp/dedupe rules and why nothing declared falls
 * back to one unit.
 *
 * EVERY type in the env gets an explicit number, zero included. The allocation hook reads the
 * selection per type and defaults a MISSING key to every free unit of that type, so any type left out
 * of the record is silently booked in full — `{}` on an 8-GPU env books all eight and prices them.
 */
export type AutoGpuSelectionArgs = {
  environment: ComputeEnvironment;
  /** The launch target's declared requirements — the GPU entry (`type: 'gpu'`) is the one read here. */
  required: DeclaredRequirement[];
  /**
   * Whether the FLOW permits a zero-unit pick (templates/services yes, custom/default models and
   * quick-start packages no). Only half the gate: the env's own GPU floor has to be 0 too, which this
   * function checks itself — see `envAllowsZero` below.
   */
  allowZeroGpu?: boolean;
};

export function autoGpuSelection({ environment, required, allowZeroGpu = false }: AutoGpuSelectionArgs): GpuSelection {
  const gpuResources = (environment.resources ?? []).filter((r) => r.type === 'gpu');
  const gpuReq = required.find((r) => r.type === 'gpu');
  const selection: GpuSelection = {};

  // Merge by description first (mirrors MergedGpu in use-inference-allocation) so a type split across
  // several resource ids gets one combined max/available, matching what the card's row is clamped to.
  const byKey = new Map<string, { max: number; available: number; allowsZero: boolean }>();
  gpuResources.forEach((r) => {
    const key = r.description || 'GPU';
    const existing = byKey.get(key);
    if (existing) {
      existing.max += r.max ?? 0;
      existing.available += grantable(r);
      // Zero-eligibility, not a summed floor: the group tolerates zero only if EVERY id merged into it
      // does. Kept as a boolean deliberately — summing the per-id `min`s produces a number that reads
      // like a clamp bound but isn't one (8 devices at min 1 would sum to 8, not 1).
      existing.allowsZero = existing.allowsZero && (r.min ?? 0) <= 0;
    } else {
      byKey.set(key, { max: r.max ?? 0, available: grantable(r), allowsZero: (r.min ?? 0) <= 0 });
    }
  });
  // Ceiling for the declared options: every GPU unit in the env, since the declared count spans types.
  const totalMax = Array.from(byKey.values()).reduce((sum, g) => sum + g.max, 0);
  // Zero is only a legitimate seed when the caller permits it AND every merged GPU type's own floor is
  // actually 0 — an env whose GPU resources declare min > 0 must still seed a real unit even for a
  // zero-declaring template, same rule declaredGpuOptions applies per row.
  const envAllowsZero = allowZeroGpu && Array.from(byKey.values()).every((g) => g.allowsZero);

  // The declared count is a TOTAL across GPU types, not a per-type figure — so draw it down across
  // keys in declared order rather than giving every key the preferred value. Live envs advertise a
  // single GPU description (8x 'NVIDIA H200' merges to one key), where both readings coincide; an env
  // exposing two distinct descriptions would otherwise book — and price — one unit of EACH for a
  // template that asked for one. The per-type option ROW still offers the declared values on every
  // type (that's the picker's policy); this is only the auto-seeded default, which must sum to what
  // was declared.
  //
  // Clamped per key to what's free right now (`available`): this selection feeds a read-only summary
  // display, and a declared/physical-max value can exceed current availability. A key with nothing
  // free takes 0 and the draw moves on, so the units land on keys that can actually give them.
  //
  // Floor is 1 UNLESS zero is both permitted and the env's own GPU floor is 0 — a target declaring 0
  // GPUs (or no GPU entry) on a zero-permitting env must seed 0, not the old blanket "nothing declared
  // → 1". `preferredGpuOption` still drives the non-zero case unchanged.
  const preferred = preferredGpuOption(declaredGpuOptions(gpuReq, totalMax, { allowZero: envAllowsZero }));
  let remaining = Math.max(preferred ?? (envAllowsZero ? 0 : 1), envAllowsZero ? 0 : 1);
  byKey.forEach(({ available }, key) => {
    const take = Math.min(available, remaining);
    selection[key] = take;
    remaining -= take;
  });
  return selection;
}

/** Options for {@link declaredGpuOptions}; see its docblock for what `allowZero` unlocks. */
export type DeclaredGpuOptionsOpts = {
  /**
   * Whether a zero-unit option may appear at all. Even when true, zero is only actually offered when
   * the launch target declares (or clamps to) 0 — this flag alone never forces zero onto a target that
   * asked for real units. Callers are also on the hook for the env's OWN floor: this helper has no
   * per-resource `min` to check (it only sees the declared requirement + a unit ceiling), so a caller
   * whose env's GPU min is > 0 must pass `allowZero: false` regardless of the launch target — see
   * {@link autoGpuSelection} and the card's `envMin` read for where that check happens.
   */
  allowZero?: boolean;
};

/**
 * The GPU unit counts to OFFER as buttons on one GPU type's row, given what the launch target
 * (template/package) declared for GPU — replaces the old blanket 1..max row with the declared RANGE,
 * so a template declaring min 2 / recommended 4 offers 2, 3 and 4 (every count that satisfies it) but
 * never 1 (below its floor) or 5+ (past what it asked for). `pickableMax` is that TYPE's own physical
 * unit count (`gpu.max` in the card, i.e. the ceiling the old 1..max loop used) — NOT current
 * availability, which only disables a button, never removes it (a unit taken by another tenant should
 * still show as a picked-then-blocked option).
 *
 * Algorithm (see spec — this is pure UX policy, the node enforces nothing here):
 * 1. Clamp the declared `min` and `recommended` endpoints into [`opts.allowZero ? 0 : 1`, pickableMax]
 *    — a value above the type's max collapses down to max; a value below the floor (a declared 0, or
 *    an env with fewer units than the declared min) rounds UP to the floor. With `allowZero` false
 *    (the default — every caller except the template flows), the floor is 1: a GPU env is sold in
 *    unit-sized slices and never offers a zero-unit button, matching the original behavior exactly.
 * 2. Fill the inclusive range between the two clamped endpoints. Equal endpoints (the common 1/1 case,
 *    or both clamping onto the same number — min 1 / recommended 4 against a 1-unit type) collapse to
 *    a single option, which is why no separate dedupe step is needed.
 *
 * No declared GPU requirement at all (`gpuReq` undefined — e.g. the custom HF-model flow, which
 * declares nothing) returns `null` when zero isn't allowed, meaning "no restriction": callers fall
 * back to the full 1..max row, unchanged from before this helper existed. When zero IS allowed and
 * nothing is declared, `null` would lose the zero option entirely (the 1..max fallback never included
 * it) — so this instead returns `[0, 1, ..., pickableMax]` explicitly, since a user on a zero-min env
 * running a no-GPU template must still be able to pick zero. This is the one case where "nothing
 * declared" does NOT mean "defer to the caller's own full-range fallback".
 */
export function declaredGpuOptions(
  gpuReq: DeclaredRequirement | undefined,
  pickableMax: number,
  opts?: DeclaredGpuOptionsOpts
): number[] | null {
  const floor = opts?.allowZero ? 0 : 1;
  if (!gpuReq) {
    if (!opts?.allowZero) {
      return null;
    }
    return Array.from({ length: Math.max(pickableMax, 0) + 1 }, (_, i) => i);
  }
  // Clamp both ENDPOINTS first, then fill the range between them, so a declared 2→4 offers 3 as well.
  // The node validates `recommended >= min`, so min is always the low end; `?? min` collapses a
  // recommended-less requirement to the single declared value.
  const ceiling = Math.max(pickableMax, floor);
  const clamp = (n: number) => Math.min(Math.max(n, floor), ceiling);
  const low = clamp(gpuReq.min);
  const high = clamp(gpuReq.recommended ?? gpuReq.min);
  // Endpoints can cross after clamping (a declared 6→6 on a 2-unit type clamps both to 2; a declared
  // 0→4 with allowZero false clamps low up to 1) — order them rather than trusting the declaration.
  const from = Math.min(low, high);
  const to = Math.max(low, high);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/**
 * The option {@link declaredGpuOptions} preselects for one GPU type: the biggest offered value. Kept
 * separate from the array itself so a seeding hook (use-template-envs/use-package-env) can ask "what
 * would the card preselect" without re-deriving/sorting the list, and so the two can never disagree —
 * see the note on autoGpuSelection above about the seeded default and the card's options needing to
 * agree on the same number.
 */
export function preferredGpuOption(options: number[] | null): number | undefined {
  if (!options || options.length === 0) {
    return undefined;
  }
  return options[options.length - 1];
}
