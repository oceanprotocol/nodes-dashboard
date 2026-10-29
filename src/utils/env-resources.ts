import { readEnvResources } from '@/components/hooks/use-env-resources';
import type { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { ComputeEnvironment, ComputeResource } from '@/types/environments';
import { getAvailableAmount } from '@/utils/resources';
import {
  assertSingleGpuGroup,
  ComputeResourceRequest,
  GpuLayout,
  GpuLayoutCandidate,
  GpuPlanCheck,
  GpuResourceRequirement,
  grantableAmount,
  parseMemoryTotalBytes,
  planGpuLayouts,
  TemplateResourceRequirement,
  validateGpuPlan,
} from '@/utils/service-resources';

/**
 * Resource math shared by the flows that match an environment to a launch target — app templates,
 * quick-start packages and custom Hugging Face models. Every GPU fit / grouping / id choice is
 * delegated to the planner vendored from ocean.js (`@/utils/service-resources`: planGpuLayouts,
 * validateGpuPlan, assertSingleGpuGroup, parseMemoryTotalBytes, grantableAmount). This module only
 * adapts the dashboard's shapes (environments, per-type selections, fee tables) to it — it never
 * decides on its own whether a GPU fits.
 */

export type { GpuLayout };

/** A declared resource recommendation — the strict template/package union (cpu/ram/disk by id, GPU by type). */
export type DeclaredRequirement = TemplateResourceRequirement;

/** The GPU member of {@link DeclaredRequirement}: total VRAM (`recommended`) + the card layouts it may book. */
export type GpuRequirement = GpuResourceRequirement;

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

export function isGpuRequirement(requirement: DeclaredRequirement): requirement is GpuRequirement {
  return 'type' in requirement && requirement.type === 'gpu';
}

/** The target's GPU recommendation, or undefined when it declares no GPU. */
export function gpuRequirementOf(required: DeclaredRequirement[] | null | undefined): GpuRequirement | undefined {
  return required?.find(isGpuRequirement);
}

/** The total VRAM (GB) a target recommends, or null when it declares no GPU at all. */
export function declaredGpuVram(required: DeclaredRequirement[] | null | undefined): number | null {
  const requirement = gpuRequirementOf(required);
  return requirement ? Math.max(0, requirement.recommended) : null;
}

/**
 * VRAM (GB) each card needs under `layout`: the whole recommendation on a single card, the layout's own
 * `vramPerGpu` on several. Undefined for a malformed multi-card layout without one — there is no
 * `recommended / n` fallback: the planner treats such a layout as unbookable, so the copy must too.
 */
export function layoutCardGb(requirement: GpuRequirement, layout: GpuLayout): number | undefined {
  if (layout.gpuCount <= 1) {
    return requirement.recommended;
  }
  return layout.vramPerGpu;
}

/** The layouts in words: "1 GPU", or "4 × 141 GB or 8 × 80 GB GPUs". Empty when none are declared. */
export function formatGpuLayouts(requirement: GpuRequirement): string {
  const layouts = (requirement.layouts ?? []).filter((l) => layoutCardGb(requirement, l) !== undefined);
  if (layouts.length === 1 && layouts[0].gpuCount === 1) {
    return '1 GPU';
  }
  return layouts
    .map((l) => `${l.gpuCount} × ${Math.round(layoutCardGb(requirement, l) ?? 0)} GB`)
    .join(' or ')
    .concat(layouts.length > 0 ? ' GPUs' : '');
}

/**
 * One card's VRAM in decimal GB, from the `memoryTotal` string the node requires on every GPU resource
 * ("143771 MiB", "141 GB", "16 GiB") — parsed by the planner's own parseMemoryTotalBytes, so the copy
 * and the fit check can't disagree. Undefined when absent or unparseable.
 */
export function gpuVramGb(resource: Pick<ComputeResource, 'memoryTotal'>): number | undefined {
  const bytes = parseMemoryTotalBytes(resource.memoryTotal);
  return bytes === undefined ? undefined : bytes / 1e9;
}

/**
 * Per-card VRAM of a group of GPU resources booked as one type: the smallest card's, like the planner.
 * Undefined when any card in the group doesn't declare its VRAM.
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

/** Whether an env resource is a GPU — the same test the allocation hook's resource reader applies. */
export function isGpuResource(resource: Pick<ComputeResource, 'id' | 'type'>): boolean {
  return resource.type === 'gpu' || resource.id === 'gpu';
}

/** The environment's GPU resources, in advertised order. */
export function gpuResourcesOf(environment: Pick<ComputeEnvironment, 'resources'>): ComputeResource[] {
  return (environment.resources ?? []).filter(isGpuResource);
}

/**
 * The GPU group a resource belongs to: its description, or `id:<id>` when it has none — asked of the
 * planner itself (assertSingleGpuGroup reports the group of a one-request selection), so every
 * selection map, request builder and the planner key groups identically. Two description-less GPUs
 * are two groups: nothing proves they are the same card.
 */
export function gpuGroupKey(resource: Pick<ComputeResource, 'id' | 'description' | 'max'>): string {
  const check = assertSingleGpuGroup([resource], [{ id: resource.id, amount: 1 }]);
  return check.ok && check.groupKey !== null ? check.groupKey : `id:${resource.id}`;
}

/** Per-unit GPU fee of every GPU id, in `tokenAddress` on the active chain (empty without a token). */
export function gpuFeesOf(
  environment: ComputeEnvironment,
  tokenAddress: string | undefined | null
): Record<string, number> {
  if (!tokenAddress) {
    return {};
  }
  return readEnvResources({ environment, freeCompute: false, tokenAddress }).gpuFees;
}

/** Fee per minute of exactly these GPU requests (sum of fee × amount; a missing fee counts 0, like the planner). */
export function gpuPriceOf(requests: ComputeResourceRequest[], fees: Record<string, number>): number {
  return requests.reduce((sum, r) => sum + (Number.isFinite(fees[r.id]) ? fees[r.id] : 0) * r.amount, 0);
}

/**
 * Whether two per-minute GPU prices are the same quote. Fees are decimal token amounts summed in
 * floating point, so equality allows a rounding hair — any real change in a fee is far larger.
 */
export function sameGpuPrice(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * What a launch target asks of the GPUs, in the planner's terms:
 *  - `vram`:  a VRAM requirement (template, package, or a custom model's memory estimate) — only its
 *             declared layouts on cards that hold them are bookable;
 *  - `units`: a card count only, memory unchecked — `widths` lists the legal counts (a custom model's
 *             tensor-parallel widths), null = any count;
 *  - `none`:  the target declares no GPU (it books zero where allowed, else one card).
 */
export type GpuDemand =
  { kind: 'vram'; requirement: GpuRequirement } | { kind: 'units'; widths: number[] | null } | { kind: 'none' };

/** The demand a target's declared resources make: its GPU requirement, or none. */
export function demandOf(required: DeclaredRequirement[] | null | undefined): GpuDemand {
  const requirement = gpuRequirementOf(required);
  return requirement && requirement.recommended > 0 ? { kind: 'vram', requirement } : { kind: 'none' };
}

/** Whether the demand needs at least one GPU (zero GPUs are never bookable for it). */
export function demandNeedsGpu(demand: GpuDemand): boolean {
  return demand.kind !== 'none';
}

/** Widths `units` demands may book when no width filter applies: any count the planner accepts. */
const ANY_WIDTH = Array.from({ length: 64 }, (_, i) => i + 1);

/**
 * A memory-unchecked demand expressed as a planner requirement: the given card counts, each card
 * needing (next to) nothing. Paired with {@link withNominalMemory}, so a card that doesn't report its
 * VRAM is still bookable by count — the planner refuses unknown memory for a VRAM requirement, which a
 * count-only demand doesn't have.
 */
function unitsRequirement(widths: number[]): GpuRequirement {
  const tiny = 1e-9;
  return {
    kind: 'discrete',
    type: 'gpu',
    unit: 'GB',
    recommended: tiny,
    layouts: widths.map((n) => (n === 1 ? { gpuCount: 1 } : { gpuCount: n, vramPerGpu: tiny })),
  };
}

const NOMINAL_MEMORY_TOTAL = '1 KB';

function withNominalMemory(gpus: ComputeResource[]): ComputeResource[] {
  return gpus.map((r) => ({ ...r, memoryTotal: NOMINAL_MEMORY_TOTAL }));
}

/** The planner inputs (resources + requirement) a demand maps to; null for `none`. */
function plannerInputs(
  gpus: ComputeResource[],
  demand: GpuDemand
): { gpuResources: ComputeResource[]; requirement: GpuRequirement } | null {
  if (demand.kind === 'vram') {
    return { gpuResources: gpus, requirement: demand.requirement };
  }
  if (demand.kind === 'units') {
    return { gpuResources: withNominalMemory(gpus), requirement: unitsRequirement(demand.widths ?? ANY_WIDTH) };
  }
  return null;
}

/**
 * Every feasible single-group booking of the demand on the environment, via the vendored planner:
 * cheapest GPU price first, then fewer cards. Empty for a `none` demand (book zero, or see
 * {@link autoGpuPick} for the one-card fallback) and when nothing fits.
 *
 * `assumeAllFree` plans against the env as if no unit were in use: what the env could EVER offer, which
 * is what the picker renders as buttons (busy ones disabled) and what decides whether an env is listed.
 */
export function planGpuDemand({
  environment,
  demand,
  fees,
  forcedGpuCount,
  assumeAllFree = false,
}: {
  environment: Pick<ComputeEnvironment, 'resources'>;
  demand: GpuDemand;
  fees?: Record<string, number>;
  forcedGpuCount?: number;
  assumeAllFree?: boolean;
}): GpuLayoutCandidate[] {
  const gpus = gpuResourcesOf(environment).map((r) => (assumeAllFree ? { ...r, inUse: 0 } : r));
  const inputs = plannerInputs(gpus, demand);
  if (!inputs) {
    return [];
  }
  return planGpuLayouts({ ...inputs, fees, forcedGpuCount });
}

/**
 * The exact GPU booking a selection stands for, carried from the picker to payment so the launch
 * books — and is charged for — the very ids that were quoted. `gpuPrice` is the per-minute GPU fee of
 * those ids in the selection's fee token (the planner's `gpuPrice`).
 */
export type GpuPlan = {
  requests: ComputeResourceRequest[];
  gpuPrice: number;
};

/** GPUs a plan books in total. */
export function planGpuCount(plan: GpuPlan | null | undefined): number {
  return (plan?.requests ?? []).reduce((sum, r) => sum + (r.amount > 0 ? r.amount : 0), 0);
}

export function planOf(candidate: GpuLayoutCandidate): GpuPlan {
  return { requests: candidate.gpuRequests, gpuPrice: candidate.gpuPrice };
}

/** A plan that books no GPU. */
export const NO_GPU_PLAN: GpuPlan = { requests: [], gpuPrice: 0 };

/** Every GPU group of the env keyed as the selection maps key them, each with its member resources. */
export function gpuGroupsOf(environment: Pick<ComputeEnvironment, 'resources'>): Map<string, ComputeResource[]> {
  const groups = new Map<string, ComputeResource[]>();
  gpuResourcesOf(environment).forEach((r) => {
    const key = gpuGroupKey(r);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  });
  return groups;
}

/**
 * The per-group selection map a set of GPU requests books — EVERY group of the env named, zero
 * included (the allocation hook reads a missing key as "every free unit of that group").
 */
export function selectionOfRequests(
  environment: Pick<ComputeEnvironment, 'resources'>,
  requests: ComputeResourceRequest[]
): GpuSelection {
  const selection: GpuSelection = {};
  for (const [key, members] of gpuGroupsOf(environment)) {
    selection[key] = requests
      .filter((r) => r.amount > 0 && members.some((m) => m.id === r.id))
      .reduce((sum, r) => sum + r.amount, 0);
  }
  return selection;
}

/**
 * Re-check a plan's exact ids against an environment (normally a fresh one) for a demand — the
 * vendored validateGpuPlan with the same rules the planner books by: ids still GPUs of the env, one
 * group, still grantable (pools whole, mins met), the booked count a declared layout (and
 * `forcedGpuCount`), the cards still holding it. Zero GPUs pass only for a `none` demand.
 */
export function validatePlanFor({
  environment,
  demand,
  plan,
  forcedGpuCount,
}: {
  environment: Pick<ComputeEnvironment, 'resources'>;
  demand: GpuDemand;
  plan: GpuPlan;
  forcedGpuCount?: number;
}): GpuPlanCheck {
  const gpus = gpuResourcesOf(environment);
  const inputs = plannerInputs(gpus, demand);
  return validateGpuPlan({
    gpuResources: inputs?.gpuResources ?? gpus,
    requirement: inputs?.requirement,
    requests: plan.requests,
    forcedGpuCount,
  });
}

/** One GPU group of an env, keyed like the selection maps — what the copy counts cards against. */
export type GpuTypeInfo = {
  key: string;
  /** Physical units of this group in the env. */
  max: number;
  /** Units free right now. */
  available: number;
  /** One card's VRAM in GB (smallest of the group); undefined when not declared. */
  vramGb?: number;
  /** Every resource id in the group declares `min: 0`. */
  allowsZero: boolean;
};

/** The env's GPU groups (see {@link gpuGroupKey}). */
export function gpuTypesOf(environment: ComputeEnvironment): GpuTypeInfo[] {
  return Array.from(gpuGroupsOf(environment), ([key, members]) => ({
    key,
    max: members.reduce((sum, r) => sum + (r.max ?? 0), 0),
    available: members.reduce((sum, r) => sum + grantableAmount(r), 0),
    vramGb: groupVramGb(members),
    allowsZero: members.every((r) => (r.min ?? 0) <= 0),
  }));
}

/** Units of a fungible/GPU resource the env can hand ONE job right now: min(max, total − inUse),
 *  the node's own gate. Single definition in @/utils/resources so every flow agrees. */
export const grantable = getAvailableAmount;

/**
 * Whether an env can currently give a target its GPU recommendation: the planner finds at least one
 * single-group layout that fits with that many cards free. Without that VRAM the model doesn't load at
 * all, so this is the one recommendation that hides an env. A target declaring no GPU fits any env.
 */
export function meetsRecommendedGpu(
  environment: ComputeEnvironment,
  required: DeclaredRequirement[],
  forcedGpuCount?: number
): boolean {
  const demand = demandOf(required);
  if (demand.kind === 'none') {
    return true;
  }
  return planGpuDemand({ environment, demand, forcedGpuCount }).length > 0;
}

export type AutoGpuPickArgs = {
  environment: ComputeEnvironment;
  /** The launch target's declared requirements — the GPU entry (`type: 'gpu'`) is the one read here. */
  required: DeclaredRequirement[];
  /**
   * Whether the FLOW permits a zero-unit pick (templates yes, packages no). Only half the gate: every
   * GPU group of the env must allow zero too (min 0), which this function checks itself.
   */
  allowZeroGpu?: boolean;
  /** Keep only the layout of this many cards (a package's pinned tensor-parallel width). */
  forcedGpuCount?: number;
  /** Fee token the pick is priced in — the cheapest candidate is chosen in it. */
  tokenAddress?: string | null;
};

/** A default pick for an env: the per-group selection (every group named) and the exact plan behind it. */
export type AutoGpuPick = { gpuSelection: GpuSelection; gpuPlan: GpuPlan };

/**
 * Default GPU pick for an env (the read-only quick-start entries): the planner's best candidate — the
 * cheapest valid single-group layout, fewer cards on a tie. A target declaring no GPU books zero where
 * the flow and env allow it, else the cheapest single card. Nothing bookable → zero everywhere, which
 * fails loudly downstream instead of booking a card the model can't use.
 */
export function autoGpuPick({
  environment,
  required,
  allowZeroGpu = false,
  forcedGpuCount,
  tokenAddress,
}: AutoGpuPickArgs): AutoGpuPick {
  const demand = demandOf(required);
  const groups = gpuTypesOf(environment);
  const zeroAllowed = allowZeroGpu && groups.every((g) => g.allowsZero);
  const fees = gpuFeesOf(environment, tokenAddress);
  if (groups.length === 0 || (demand.kind === 'none' && zeroAllowed)) {
    return { gpuSelection: selectionOfRequests(environment, []), gpuPlan: NO_GPU_PLAN };
  }
  const effective: GpuDemand = demand.kind === 'none' ? { kind: 'units', widths: [1] } : demand;
  const best = planGpuDemand({ environment, demand: effective, fees, forcedGpuCount })[0];
  const plan = best ? planOf(best) : NO_GPU_PLAN;
  return { gpuSelection: selectionOfRequests(environment, plan.requests), gpuPlan: plan };
}

/** One GPU group as the env picker renders it: the counts it can ever offer and those bookable now. */
export type GpuPickerGroup = GpuTypeInfo & {
  /** Card counts this group can EVER offer for the demand (planned as if no unit were in use), ascending. */
  offered: number[];
  /** Candidates bookable right now, by card count. */
  live: Map<number, GpuLayoutCandidate>;
};

/**
 * What the env picker offers: per group, the planner's counts (busy ones disabled), the candidates
 * bookable now, and the cheapest of them — the default seed. `unitBudget` (how many cards the free
 * CPU/RAM/disk can back) only removes candidates; it never changes the planner's ranking.
 */
export function gpuPickerModel({
  environment,
  demand,
  fees,
  forcedGpuCount,
  unitBudget,
}: {
  environment: ComputeEnvironment;
  demand: GpuDemand;
  fees: Record<string, number>;
  forcedGpuCount?: number;
  unitBudget: number;
}): { groups: GpuPickerGroup[]; best: GpuLayoutCandidate | null } {
  // A target needing no GPU still books whole cards on an env that can't do zero: one at a time.
  const effective: GpuDemand = demand.kind === 'none' ? { kind: 'units', widths: null } : demand;
  const ever = planGpuDemand({ environment, demand: effective, fees, forcedGpuCount, assumeAllFree: true });
  const now = planGpuDemand({ environment, demand: effective, fees, forcedGpuCount }).filter(
    (c) => (c.layout?.gpuCount ?? 0) <= unitBudget
  );
  const groups = gpuTypesOf(environment).map((info) => {
    const offered = Array.from(
      new Set(ever.filter((c) => c.groupKey === info.key).map((c) => c.layout?.gpuCount ?? 0))
    ).sort((a, b) => a - b);
    const live = new Map<number, GpuLayoutCandidate>();
    now
      .filter((c) => c.groupKey === info.key)
      .forEach((c) => {
        const n = c.layout?.gpuCount ?? 0;
        if (!live.has(n)) {
          live.set(n, c);
        }
      });
    return { ...info, offered, live };
  });
  return { groups, best: now[0] ?? null };
}
