import { EnvResources, readEnvResources } from '@/components/hooks/use-env-resources';
import {
  computeInferenceAllocation,
  GpuSelection,
  MergedGpu,
  mergeGpuTypes,
  ResourceAmounts,
  ResourceSizing,
  sliceFor,
  totalUnitsOf,
} from '@/components/hooks/use-inference-allocation';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { assertAllocationAvailable } from '@/services/inference-launch';
import { ComputeEnvironment } from '@/types/environments';
import {
  DeclaredRequirement,
  GpuDemand,
  GpuPlan,
  GpuRequirement,
  NO_GPU_PLAN,
  planGpuCount,
  planGpuDemand,
  planOf,
  selectionOfRequests,
} from '@/utils/env-resources';
import { serviceDurationBounds } from '@/utils/service-duration';

/**
 * Quick start: pick the environment a template or package launches on, so the user only chooses a
 * session length. Pure: the details page's useQuickStart hook feeds it the resolved environments (and, once
 * Start is pressed, the node's own fresh copies of them) and re-plans whenever any of that changes.
 *
 * How a pick is made:
 *  1. GPU: the target declares the total VRAM it recommends and the layouts (card counts, each with
 *     the VRAM a card needs) it may be booked as. The candidates are the vendored ocean.js planner's
 *     (planGpuLayouts): every declared layout one GPU group of the environment fits with that many
 *     whole cards free, with its exact ids and GPU price. Groups are never mixed, pooled resources are
 *     only booked whole, and a package's pinned tensor-parallel width keeps only its own layout.
 *  2. CPU/RAM/disk: the target's RECOMMENDED amounts (see recommendedSizing). There is no declared
 *     minimum: an environment short of them books what it can grant, down to its own per-job min.
 *  3. Among environments that can host it: one that gives the full recommended CPU/RAM/disk first,
 *     then verified nodes, then the cheaper one for the chosen session length, then the higher
 *     benchmark score.
 *
 * An environment only counts as able to host a pick when it passes the same checks an env card runs
 * before its Continue (unit budget, cross-resource constraints, free GPU ids, free shared resources),
 * so the quick start can never hand the payment step a pick the card would have refused.
 */

/** What both env resolvers produce per environment (ResolvedTemplateEnv / ResolvedPackageEnv). */
export type QuickStartEntry = { env: SelectedInferenceEnv; token: SelectedToken | null };

/** One environment the planner may launch on: an entry, and the copy of its env to plan against. */
export type QuickStartCandidate<T extends QuickStartEntry> = {
  /** {@link envKey} of the entry, stable even when a fresh read comes back under a new env id. */
  key: string;
  entry: T;
  /** The node's own copy once one was read, else the resolver's snapshot. */
  environment: ComputeEnvironment;
  token: SelectedToken;
};

export type QuickStartOption<T extends QuickStartEntry> = {
  candidate: QuickStartCandidate<T>;
  /** The GPU type booked (MergedGpu.key), or null for a pick that books no GPU. */
  gpuKey: string | null;
  gpuLabel: string | null;
  gpuCount: number;
  /** A count for EVERY GPU type of the env, zero included: a missing key books that type in full. */
  gpuSelection: GpuSelection;
  /** The exact GPU ids booked and their per-minute price — carried to payment and re-checked there. */
  gpuPlan: GpuPlan;
  /** The CPU/RAM/disk sizing this pick is priced on: the entry's, scaled to the GPU count booked. */
  sizing: ResourceSizing | undefined;
  allocation: ResourceAmounts;
  /** Whether the allocation reaches the sizing's recommended amounts, not just what the env could grant. */
  fullSizing: boolean;
  price: number;
};

export type QuickStartPlan<T extends QuickStartEntry> =
  | { status: 'ready'; option: QuickStartOption<T> }
  /** Environments that fit exist, but none of them takes this session length. */
  | { status: 'duration'; suggestionSeconds: number }
  | { status: 'none' };

/** Identifies an entry across re-reads: node + the env id the resolver listed it under. */
export function envKey(env: SelectedInferenceEnv): string {
  return `${env.nodeInfo.id}-${env.environment.id}`;
}

/**
 * A template's or package's quick-start sizing: its RECOMMENDED CPU/RAM/disk, booked best effort — the
 * zero `floor` tells the allocation to clamp an amount the environment can't grant down to what it can
 * (never under the env's own per-job min) rather than refusing the environment. A resource it declares
 * nothing for is marked `slice`: the planner books the GPU slice of it, as the custom flow would.
 * Undefined when no CPU/RAM/disk is declared at all (the GPU slice then sizes them).
 */
export function recommendedSizing(required: DeclaredRequirement[] | null | undefined): ResourceSizing | undefined {
  const find = (id: string) => required?.find((r) => 'id' in r && r.id === id);
  if (!find('cpu') && !find('ram') && !find('disk')) {
    return undefined;
  }
  const recommended = (id: string) => Math.max(0, find(id)?.recommended ?? 0);
  const slice = (['cpu', 'ram', 'disk'] as const).filter((key) => !find(key));
  return {
    mode: 'pinned',
    cpu: recommended('cpu'),
    ram: recommended('ram'),
    disk: recommended('disk'),
    floor: { cpu: 0, ram: 0, disk: 0 },
    ...(slice.length > 0 ? { slice } : {}),
  };
}

/**
 * The entry's sizing for `units` GPUs on one environment: the recommended CPU/RAM/disk as they are (a
 * pick always books the cards the VRAM recommendation needs, so nothing scales), except a resource
 * marked `slice`, which books this environment's GPU slice of it instead. The result carries plain
 * numbers, so it survives the URL and the payment step as it is.
 */
function sizingFor({
  sizing,
  units,
  resources,
  totalGpus,
}: {
  sizing: ResourceSizing | undefined;
  units: number;
  resources: EnvResources;
  totalGpus: number;
}): ResourceSizing | undefined {
  if (sizing?.mode !== 'pinned') {
    return sizing;
  }
  const { slice = [], ...pinned } = sizing;
  const amount = (key: keyof ResourceAmounts) =>
    slice.includes(key) ? sliceFor(resources[key], units, totalGpus) : sizing[key];
  return { ...pinned, cpu: amount('cpu'), ram: amount('ram'), disk: amount('disk') };
}

/**
 * The entries the planner may use: those with a paid token, not ruled out by a previous Start, and
 * not denied by their access list, each planned against the node's fresh copy when one was read.
 */
export function toCandidates<T extends QuickStartEntry>({
  entries,
  fresh,
  excluded,
  access,
}: {
  entries: T[];
  fresh: Record<string, ComputeEnvironment>;
  excluded: Record<string, true>;
  access: Record<string, boolean | null>;
}): QuickStartCandidate<T>[] {
  const candidates: QuickStartCandidate<T>[] = [];
  entries.forEach((entry) => {
    const key = envKey(entry.env);
    if (!entry.token || excluded[key] || access[key] === false) {
      return;
    }
    candidates.push({ key, entry, environment: fresh[key] ?? entry.env.environment, token: entry.token });
  });
  return candidates;
}

/** One planned GPU booking (or none) on one candidate; null when the env can't host it right now. */
function evaluate<T extends QuickStartEntry>({
  candidate,
  types,
  gpuKey,
  plan,
  envResources,
  durationSeconds,
}: {
  candidate: QuickStartCandidate<T>;
  types: MergedGpu[];
  gpuKey: string | null;
  /** The planner's exact ids for the booking (NO_GPU_PLAN for none). */
  plan: GpuPlan;
  /** The environment's CPU/RAM/disk/GPUs as read for this token, for the GPU slice of `slice` resources. */
  envResources: EnvResources;
  durationSeconds: number;
}): QuickStartOption<T> | null {
  const { environment, token } = candidate;
  const units = planGpuCount(plan);
  const gpuSelection: GpuSelection = selectionOfRequests(environment, plan.requests);
  const sizing = sizingFor({
    sizing: candidate.entry.env.sizing,
    units,
    resources: envResources,
    totalGpus: totalUnitsOf(types),
  });
  const result = computeInferenceAllocation({
    environment,
    tokenAddress: token.address,
    gpuSelection,
    gpuRequests: plan.requests,
    sizing,
    durationSeconds,
  });
  if (result.selectedTotal !== units) {
    return null;
  }
  if (units > 0 && (result.gpuExhausted || units > result.maxUnitsByResources)) {
    return null;
  }
  if (result.constraintViolation) {
    return null;
  }
  // The planner already proved the GPU ids free on this copy; what's left of the env card's Continue
  // checks is the shared CPU/RAM/disk still free at the amounts this pick is priced on.
  const resources = environment.resources ?? [];
  try {
    assertAllocationAvailable(resources, result.allocation);
  } catch {
    return null;
  }
  // A `floor` sizing (advanced handoff) must not be clamped under its floor; a pinned recommendation
  // carries a zero floor, so it is booked as far as the env can grant it.
  const keys = ['cpu', 'ram', 'disk'] as const;
  const floor = sizing?.mode === 'pinned' ? sizing.floor : sizing?.mode === 'floor' ? sizing : undefined;
  if (floor && keys.some((key) => result.allocation[key] < floor[key])) {
    return null;
  }
  const fullSizing = sizing?.mode !== 'pinned' || keys.every((key) => result.allocation[key] >= sizing[key]);
  const type = types.find((t) => t.key === gpuKey);
  return {
    candidate,
    gpuKey,
    gpuLabel: type ? type.description || 'GPU' : null,
    gpuCount: units,
    gpuSelection: result.selectedByKey,
    gpuPlan: plan,
    sizing,
    allocation: result.allocation,
    fullSizing,
    price: result.price,
  };
}

/**
 * The best pick on one environment: every candidate the vendored planner finds for the GPU requirement
 * (the cheapest single card when the target declares no GPU but the env sells none without one). Groups
 * are never mixed (a multi-GPU model shards across identical devices). Every candidate is evaluated,
 * not just the cheapest: a constraint can rule a narrow one out while a wider one still works. The one
 * giving the full recommended CPU/RAM/disk wins, then the cheapest, then the fewer cards.
 */
function bestFitOn<T extends QuickStartEntry>({
  candidate,
  gpuRequirement,
  forcedGpuCount,
  allowZeroGpu,
  durationSeconds,
}: {
  candidate: QuickStartCandidate<T>;
  gpuRequirement: GpuRequirement | null;
  forcedGpuCount?: number;
  allowZeroGpu: boolean;
  durationSeconds: number;
}): QuickStartOption<T> | null {
  const resources = readEnvResources({
    environment: candidate.environment,
    freeCompute: false,
    tokenAddress: candidate.token.address,
  });
  // The shared resources have to have something free to be booked at all. A GPU pick is held to this
  // by the unit budget already; a zero-GPU pick or a GPU-less environment is not.
  const sharedExhausted = (
    [
      [resources.cpu, resources.cpuAvailable],
      [resources.ram, resources.ramAvailable],
      [resources.disk, resources.diskAvailable],
    ] as const
  ).some(([resource, available]) => resource && available <= 0);
  if (sharedExhausted) {
    return null;
  }
  const types = mergeGpuTypes(resources);
  const needsGpu = gpuRequirement !== null && gpuRequirement.recommended > 0;
  if (needsGpu && !gpuRequirement) {
    return null;
  }

  // No GPUs in this environment: it hosts only a target that needs none.
  if (types.length === 0) {
    if (needsGpu) {
      return null;
    }
    return evaluate({ candidate, types, gpuKey: null, plan: NO_GPU_PLAN, envResources: resources, durationSeconds });
  }

  // Zero units only where the flow permits it (templates) AND every GPU type of the env allows it,
  // the same gate the env card applies. Otherwise a GPU environment is booked in whole units.
  const zeroAllowed = allowZeroGpu && types.every((t) => t.allowsZero);
  if (!needsGpu && zeroAllowed) {
    return evaluate({ candidate, types, gpuKey: null, plan: NO_GPU_PLAN, envResources: resources, durationSeconds });
  }
  // A target declaring no GPU (or zero VRAM) wants as few as possible: one card.
  const demand: GpuDemand = needsGpu ? { kind: 'vram', requirement: gpuRequirement } : { kind: 'units', widths: [1] };
  const options = planGpuDemand({
    environment: candidate.environment,
    demand,
    fees: resources.gpuFees,
    forcedGpuCount,
  })
    .map((planned) =>
      evaluate({
        candidate,
        types,
        gpuKey: planned.groupKey,
        plan: planOf(planned),
        envResources: resources,
        durationSeconds,
      })
    )
    .filter((option): option is QuickStartOption<T> => option !== null)
    .sort((a, b) => Number(b.fullSizing) - Number(a.fullSizing) || a.price - b.price || a.gpuCount - b.gpuCount);
  return options[0] ?? null;
}

/**
 * The full recommended CPU/RAM/disk first, then verified, then cheaper, then the higher benchmark
 * score, then the fewer cards. The sizing ranks above price: an env short of the recommendation is cheaper exactly because
 * it books less.
 */
function compareOptions<T extends QuickStartEntry>() {
  return (a: QuickStartOption<T>, b: QuickStartOption<T>): number => {
    const sizing = Number(b.fullSizing) - Number(a.fullSizing);
    if (sizing !== 0) {
      return sizing;
    }
    const verified =
      Number(!!b.candidate.entry.env.nodeInfo.verified) - Number(!!a.candidate.entry.env.nodeInfo.verified);
    if (verified !== 0) {
      return verified;
    }
    if (a.price !== b.price) {
      return a.price - b.price;
    }
    const score = (option: QuickStartOption<T>) =>
      option.candidate.entry.env.nodeInfo.latestBenchmarkResults?.totalScore ?? 0;
    return score(b) - score(a) || a.gpuCount - b.gpuCount;
  };
}

export function planQuickStart<T extends QuickStartEntry>({
  candidates,
  gpuRequirement,
  forcedGpuCount,
  allowZeroGpu,
  durationSeconds,
}: {
  candidates: QuickStartCandidate<T>[];
  /** The target's GPU recommendation (total VRAM + layouts); null when it declares no GPU (it then
   *  books as few as the environment allows). */
  gpuRequirement: GpuRequirement | null;
  /** Keep only the layout of this many cards: a package's pinned tensor-parallel width. */
  forcedGpuCount?: number;
  /** Whether the flow permits a zero-GPU pick at all: templates yes, packages no. */
  allowZeroGpu: boolean;
  durationSeconds: number;
}): QuickStartPlan<T> {
  const fitting: QuickStartOption<T>[] = [];
  // Hosting doesn't depend on the session length, only the price does, so an environment that fits
  // but not this length still tells the user which length would work.
  let suggestionSeconds: number | null = null;
  for (const candidate of candidates) {
    const option = bestFitOn({ candidate, gpuRequirement, forcedGpuCount, allowZeroGpu, durationSeconds });
    if (!option) {
      continue;
    }
    const { min, max } = serviceDurationBounds(candidate.environment);
    if (durationSeconds >= min && durationSeconds <= max) {
      fitting.push(option);
      continue;
    }
    const nearest = Math.min(Math.max(durationSeconds, min), max);
    if (
      suggestionSeconds === null ||
      Math.abs(nearest - durationSeconds) < Math.abs(suggestionSeconds - durationSeconds)
    ) {
      suggestionSeconds = nearest;
    }
  }
  if (fitting.length > 0) {
    fitting.sort(compareOptions());
    return { status: 'ready', option: fitting[0] };
  }
  if (suggestionSeconds !== null) {
    return { status: 'duration', suggestionSeconds };
  }
  return { status: 'none' };
}
