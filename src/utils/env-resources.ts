import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { ComputeEnvironment, ComputeResource } from '@/types/environments';
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

/** Shown wherever a compute-job control is disabled because the env opted out. Mirrors the node's own
 *  403 message so the UI and a raw API error read the same. */
export const COMPUTE_JOBS_DISABLED_REASON = 'Compute jobs are not enabled on this environment';

/**
 * Whether an environment accepts one-shot compute jobs. Gates BOTH paid and free — the node applies
 * the same guard to COMPUTE_START and FREE_COMPUTE_START, returning 403
 * {@link COMPUTE_JOBS_DISABLED_REASON} from either (ocean-node `startCompute.ts`).
 *
 * Absent/undefined means CAPABLE, hence `!== false` rather than `=== true`: the node defaults the flag
 * to true both at config parse and at runtime construction, and every node predating the flag sends no
 * `features` key at all — testing for `=== true` would disable the control on essentially every env.
 *
 * Says nothing about `features.services`, which is an independent capability: an env may legitimately
 * be services-only. Note the asymmetry with the inference flow's `!env.features?.services` checks,
 * where absent means NOT bookable — that gating is policy-conservative (paired with the
 * ON_INFERENCE_NODES allowlist), while this one mirrors a node guard whose default is true. The two
 * are deliberately different; don't unify them.
 */
export function supportsComputeJobs(environment: ComputeEnvironment): boolean {
  return environment.features?.computeJobs !== false;
}

/**
 * One allowed way to spread a GPU recommendation over identical cards of ONE type on ONE host — the
 * same shape ocean-node validates. `gpuCount` is exactly what gets booked and used (TP/TEP width, or
 * one model per card). A one-card layout carries no `vramPerGpu`: that card must hold the whole
 * `recommended`. A multi-card layout states the VRAM each card needs.
 */
export type GpuLayout = { gpuCount: number; vramPerGpu?: number };

/**
 * A declared resource recommendation: `cpu`/`ram`/`disk` by id, or GPU by `type: 'gpu'`. There is no
 * floor — `recommended` is the one amount a template/package states. For cpu/ram/disk it is booked as
 * far as the env can grant it; for GPU it is the TOTAL VRAM in GB (the headline), and `layouts` lists
 * the card counts it may be booked as (see {@link fittingGpuCounts}).
 */
export type DeclaredRequirement = {
  id?: string;
  type?: string;
  recommended: number;
  unit?: string;
  /** Discrete (whole-unit, e.g. GPU) vs fungible (continuous, e.g. cpu/ram/disk). Carried by real
   *  template/package data; not matched on — every consumer here keys off `type`/`id` instead. */
  kind?: 'discrete' | 'fungible';
  /** GPU only: the card counts the recommendation may be booked as. Mandatory on a GPU entry. */
  layouts?: GpuLayout[];
  /** GPU only: the userConfigurableEnvVars key that forces an exact card count at launch. */
  gpuCountEnv?: string;
};

export function isGpuRequirement(requirement: DeclaredRequirement): boolean {
  return requirement.type === 'gpu' || requirement.id === 'gpu';
}

/** The target's GPU recommendation, or undefined when it declares no GPU. */
export function gpuRequirementOf(required: DeclaredRequirement[] | null | undefined): DeclaredRequirement | undefined {
  return required?.find(isGpuRequirement);
}

/** The total VRAM (GB) a target recommends, or null when it declares no GPU at all. */
export function declaredGpuVram(required: DeclaredRequirement[] | null | undefined): number | null {
  const requirement = gpuRequirementOf(required);
  return requirement ? Math.max(0, requirement.recommended) : null;
}

/** VRAM (GB) each card needs under `layout`: the whole recommendation on a single card. */
export function layoutCardGb(requirement: DeclaredRequirement, layout: GpuLayout): number {
  if (layout.gpuCount <= 1) {
    return requirement.recommended;
  }
  return layout.vramPerGpu ?? requirement.recommended / layout.gpuCount;
}

/** The layouts in words: "1 GPU", or "4 × 141 GB or 8 × 80 GB GPUs". Empty when none are declared. */
export function formatGpuLayouts(requirement: DeclaredRequirement): string {
  const layouts = requirement.layouts ?? [];
  if (layouts.length === 1 && layouts[0].gpuCount === 1) {
    return '1 GPU';
  }
  return layouts
    .map((l) =>
      l.gpuCount === 1
        ? `1 × ${Math.round(requirement.recommended)} GB`
        : `${l.gpuCount} × ${Math.round(layoutCardGb(requirement, l))} GB`
    )
    .join(' or ')
    .concat(layouts.length > 0 ? ' GPUs' : '');
}

const MEMORY_UNIT_BYTES: Record<string, number> = {
  b: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
};

/**
 * One card's VRAM in decimal GB, from the `memoryTotal` string the node requires on every GPU resource
 * ("143771 MiB", "141 GB", "16 GiB"). Same grammar as ocean-node's parseMemoryTotalToBytes, so the
 * dashboard and the node agree on what a card holds. Undefined when absent or unparseable — such a card
 * can't be sized against a VRAM recommendation.
 */
export function gpuVramGb(resource: Pick<ComputeResource, 'memoryTotal'>): number | undefined {
  const match = String(resource.memoryTotal ?? '')
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]{1,3})?$/);
  if (!match) {
    return undefined;
  }
  const factor = MEMORY_UNIT_BYTES[(match[2] || 'B').toLowerCase()];
  const gb = factor ? (parseFloat(match[1]) * factor) / 1e9 : NaN;
  return Number.isFinite(gb) && gb > 0 ? gb : undefined;
}

/**
 * Per-card VRAM of a group of GPU resources booked as one type (merged by description): the smallest
 * card's, so a layout is never matched against a card bigger than one the launch may draw. Undefined
 * when any card in the group doesn't declare its VRAM.
 */
export function groupVramGb(resources: Pick<ComputeResource, 'memoryTotal'>[]): number | undefined {
  let smallest: number | undefined;
  for (const resource of resources) {
    const gb = gpuVramGb(resource);
    if (gb === undefined) {
      return undefined;
    }
    smallest = smallest === undefined ? gb : Math.min(smallest, gb);
  }
  return smallest;
}

// Compared in whole bytes, like the node, so "141 GB" meets a 141 GB layout exactly.
const toBytes = (gb: number) => Math.ceil(gb * 1e9 - 1e-3);

/**
 * The declared card counts that fit cards of `cardVramGb`, ascending: each card holds its layout's
 * share and the cards together hold the recommendation. `forcedGpuCount` (a package's pinned
 * tensor-parallel width, or a template's forced width) keeps only that layout. Empty when the card's
 * VRAM is unknown, or the requirement declares no layouts — such a card can't be sized against it, and
 * cards are never pooled to make up a single-card recommendation.
 */
export function fittingGpuCounts(
  requirement: DeclaredRequirement,
  cardVramGb: number | undefined,
  forcedGpuCount?: number
): number[] {
  if (cardVramGb === undefined || cardVramGb <= 0) {
    return [];
  }
  const cardBytes = Math.round(cardVramGb * 1e9);
  return (requirement.layouts ?? [])
    .filter((layout) => forcedGpuCount === undefined || layout.gpuCount === forcedGpuCount)
    .filter(
      (layout) =>
        cardBytes >= toBytes(layoutCardGb(requirement, layout)) &&
        layout.gpuCount * cardBytes >= toBytes(requirement.recommended)
    )
    .map((layout) => layout.gpuCount)
    .sort((a, b) => a - b);
}

/** One GPU type of an env, keyed by description — what the layout rules count cards against. */
export type GpuTypeInfo = {
  key: string;
  /** Physical units of this type in the env. */
  max: number;
  /** Units free right now. */
  available: number;
  /** One card's VRAM in GB (smallest of the group); undefined when not declared. */
  vramGb?: number;
  /** Every resource id merged into the type declares `min: 0`. */
  allowsZero: boolean;
};

/** The env's GPU resources merged by description, as the allocation hook and buildGpuRequests key them. */
export function gpuTypesOf(environment: ComputeEnvironment): GpuTypeInfo[] {
  const groups = new Map<string, ComputeResource[]>();
  (environment.resources ?? [])
    .filter((r) => r.type === 'gpu')
    .forEach((r) => {
      const key = r.description || 'GPU';
      groups.set(key, [...(groups.get(key) ?? []), r]);
    });
  return Array.from(groups, ([key, members]) => ({
    key,
    max: members.reduce((sum, r) => sum + (r.max ?? 0), 0),
    available: members.reduce((sum, r) => sum + grantable(r), 0),
    vramGb: groupVramGb(members),
    // Zero-eligibility, not a summed floor: the group tolerates zero only if EVERY id merged into it
    // does. Kept as a boolean deliberately — summing the per-id `min`s produces a number that reads
    // like a clamp bound but isn't one (8 devices at min 1 would sum to 8, not 1).
    allowsZero: members.every((r) => (r.min ?? 0) <= 0),
  }));
}

/** Units of a fungible/GPU resource the env can hand ONE job right now: min(max, total − inUse),
 *  the node's own gate. Single definition in @/utils/resources so every flow agrees. */
export const grantable = getAvailableAmount;

/**
 * Whether an env can currently give a target its GPU recommendation: some single GPU type (cards are
 * never mixed — a model shards across identical devices) has a declared layout that fits its cards
 * with that many cards free. Without that VRAM the model doesn't load at all, so this is the one
 * recommendation that hides an env. CPU/RAM/disk never do: they are booked as far as the env can grant
 * them (see recommendedSizing). A target declaring no GPU fits any env.
 */
export function meetsRecommendedGpu(
  environment: ComputeEnvironment,
  required: DeclaredRequirement[],
  forcedGpuCount?: number
): boolean {
  const requirement = gpuRequirementOf(required);
  if (!requirement || requirement.recommended <= 0) {
    return true;
  }
  return gpuTypesOf(environment).some((t) =>
    fittingGpuCounts(requirement, t.vramGb, forcedGpuCount).some((n) => n <= t.available)
  );
}

/**
 * Auto GPU selection for a read-only card: the smallest declared layout that fits, on the first GPU
 * type (keyed by `description`, what the allocation hook / buildGpuRequests match on) with that many
 * cards free. Same value the editable card (inference-environment-card) preselects, so a package or
 * template's static card and the Advanced picker never disagree on the default.
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
  /** Keep only the layout of this many cards (a package's pinned tensor-parallel width). */
  forcedGpuCount?: number;
};

export function autoGpuSelection({
  environment,
  required,
  allowZeroGpu = false,
  forcedGpuCount,
}: AutoGpuSelectionArgs): GpuSelection {
  const types = gpuTypesOf(environment);
  const gpuReq = gpuRequirementOf(required);
  const selection: GpuSelection = Object.fromEntries(types.map((t) => [t.key, 0]));
  // Zero is only a legitimate seed when the caller permits it AND every merged GPU type's own floor is
  // actually 0 — an env whose GPU resources declare min > 0 must still seed a real unit even for a
  // zero-declaring template, same rule declaredGpuOptions applies per row.
  const envAllowsZero = allowZeroGpu && types.every((g) => g.allowsZero);
  const floor = envAllowsZero ? 0 : 1;

  if (gpuReq && gpuReq.recommended > 0) {
    // Met on ONE type, never by mixing cards of two types: the first type with a fitting layout free.
    for (const t of types) {
      const units = fittingGpuCounts(gpuReq, t.vramGb, forcedGpuCount).find((n) => n <= t.available);
      if (units !== undefined) {
        selection[t.key] = units;
        return selection;
      }
    }
    // No type can host it: book nothing. Callers only reach here for an env the filters let through,
    // so this is the stale-availability case, and an empty pick fails loudly downstream instead of
    // booking a card the model can't use.
    return selection;
  }

  // Nothing (or zero VRAM) declared: the fewest units the env sells — a target that can't use a GPU
  // (jupyterlab, hermes) must not book, and price, every free unit. With zero permitted that is 0;
  // otherwise the 1-unit floor a GPU env is sold in, drawn from the first type with a free unit.
  let remaining = floor;
  types.forEach((t) => {
    const take = Math.min(t.available, remaining);
    selection[t.key] = take;
    remaining -= take;
  });
  return selection;
}

/** Options for {@link declaredGpuOptions}; see its docblock for what `allowZero` unlocks. */
export type DeclaredGpuOptionsOpts = {
  /**
   * Whether a zero-unit option may appear for a target that declares no GPU. Callers are on the hook
   * for the env's OWN floor: a caller whose env's GPU min is > 0 must pass `allowZero: false` — see
   * {@link autoGpuSelection} and the card's `envMin` read for where that check happens.
   */
  allowZero?: boolean;
  /** Keep only the layout of this many cards (a package's pinned tensor-parallel width). */
  forcedGpuCount?: number;
};

/**
 * The GPU unit counts to OFFER as buttons on one GPU type's row. A target that declares a GPU
 * recommendation offers exactly its declared layouts that fit THIS type's cards (and its physical
 * unit count) — possibly none, when the cards are too small or don't declare their VRAM; the row then
 * offers nothing rather than an arbitrary count the model can't use. `gpu.max` is the type's physical
 * unit count, NOT current availability, which only disables a button, never removes it.
 *
 * With nothing declared (the hand-sized custom HF-model flow) this returns `null`, "no restriction",
 * so callers render the full 1..max row. When zero IS allowed, `null` would lose the zero option (the
 * 1..max fallback never included it), so this instead returns `[0, 1, ..., gpu.max]` explicitly — a
 * user on a zero-min env running a no-GPU template must still be able to pick zero.
 */
export function declaredGpuOptions(
  gpuReq: DeclaredRequirement | undefined,
  gpu: Pick<GpuTypeInfo, 'max' | 'vramGb'>,
  opts?: DeclaredGpuOptionsOpts
): number[] | null {
  if (gpuReq && gpuReq.recommended > 0) {
    return fittingGpuCounts(gpuReq, gpu.vramGb, opts?.forcedGpuCount).filter((n) => n <= gpu.max);
  }
  if (!opts?.allowZero) {
    return null;
  }
  return Array.from({ length: Math.max(gpu.max, 0) + 1 }, (_, i) => i);
}

/**
 * The option {@link declaredGpuOptions} preselects for one GPU type: the smallest offered value — the
 * cheapest layout that holds the recommendation; a wider one stays one click away. Kept separate from
 * the array itself so a seeding hook can ask "what would the card preselect" without re-deriving it.
 */
export function preferredGpuOption(options: number[] | null): number | undefined {
  if (!options || options.length === 0) {
    return undefined;
  }
  return options[0];
}
