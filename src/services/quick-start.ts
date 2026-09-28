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
import { assertAllocationAvailable, buildGpuRequests } from '@/services/inference-launch';
import { ComputeEnvironment } from '@/types/environments';
import { DeclaredRequirement } from '@/utils/env-resources';
import { serviceDurationBounds } from '@/utils/service-duration';

/**
 * Quick start: pick the environment a template or package launches on, so the user only chooses a
 * session length. Pure: the modal's useQuickStart hook feeds it the resolved environments (and, once
 * Start is pressed, the node's own fresh copies of them) and re-plans whenever any of that changes.
 *
 * How a pick is made:
 *  1. GPU count first. Try the target's RECOMMENDED unit count and walk down towards its declared
 *     MINIMUM until some environment can host it.
 *  2. CPU/RAM/disk: the target's RECOMMENDED amounts (see recommendedSizing), scaled down with the GPU
 *     count when fewer units than recommended are booked. An environment short of them books less,
 *     down to the declared MINIMUM and never below it.
 *  3. Among environments that host the same count: one that gives the full recommended CPU/RAM/disk
 *     first, then verified nodes, then the cheaper one for the chosen session length, then the higher
 *     benchmark score.
 *
 * An environment only counts as able to host a pick when it passes the same checks an env card runs
 * before its Continue (unit budget, cross-resource constraints, free GPU ids, free shared resources),
 * so the quick start can never hand the payment step a pick the card would have refused.
 */

/** GPU units a launch target declares: the floor it runs at, and the count it's tuned for. */
export type GpuRange = { min: number; recommended: number };

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
  /** The CPU/RAM/disk sizing this pick is priced on: the entry's, scaled to the GPU count booked. */
  sizing: ResourceSizing | undefined;
  allocation: ResourceAmounts;
  /** Whether the allocation reaches the sizing's recommended amounts, not just its minimums. */
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

export function isGpuRequirement(requirement: DeclaredRequirement): boolean {
  return requirement.type === 'gpu' || requirement.id === 'gpu';
}

/**
 * The GPU range a template/package declares, or null when it declares no GPU at all. The floor is
 * the requirement's `min`; the target prefers a separate recommendation list (templates publish one),
 * then the requirement's own `recommended` (packages), then its `min`.
 */
export function declaredGpuRange(
  required: DeclaredRequirement[] | null | undefined,
  recommended?: DeclaredRequirement[] | null
): GpuRange | null {
  const requirement = required?.find(isGpuRequirement);
  const recommendation = recommended?.find(isGpuRequirement);
  if (!requirement && !recommendation) {
    return null;
  }
  const min = Math.max(0, requirement?.min ?? recommendation?.min ?? 0);
  const target = recommendation?.recommended ?? recommendation?.min ?? requirement?.recommended ?? min;
  return { min, recommended: Math.max(min, target) };
}

/**
 * A template's or package's quick-start sizing: its RECOMMENDED CPU/RAM/disk, floored at its declared
 * MIN (a resource declaring no recommendation books its min). The allocation clamps a pinned amount to
 * what the environment can grant, down to the floor, so an environment short of the recommendation
 * books less rather than being skipped. A resource it declares nothing for is marked `slice`: the
 * planner books the GPU slice of it, as `floor` sizing would. Undefined when no CPU/RAM/disk is
 * declared at all (the GPU slice then sizes them).
 */
export function recommendedSizing(required: DeclaredRequirement[] | null | undefined): ResourceSizing | undefined {
  const find = (id: string) => required?.find((r) => r.id === id);
  if (!find('cpu') && !find('ram') && !find('disk')) {
    return undefined;
  }
  const min = (id: string) => find(id)?.min ?? 0;
  const recommended = (id: string) => Math.max(min(id), find(id)?.recommended ?? 0);
  const slice = (['cpu', 'ram', 'disk'] as const).filter((key) => !find(key));
  return {
    mode: 'pinned',
    cpu: recommended('cpu'),
    ram: recommended('ram'),
    disk: recommended('disk'),
    floor: { cpu: min('cpu'), ram: min('ram'), disk: min('disk') },
    ...(slice.length > 0 ? { slice } : {}),
  };
}

/**
 * The entry's sizing for `units` GPUs on one environment. Recommended CPU/RAM/disk are stated for the
 * recommended GPU count, so booking fewer units scales them down in proportion, never below the floor.
 * A resource marked `slice` books this environment's GPU slice of it instead. The result carries
 * plain numbers, so it survives the URL and the payment step as it is.
 */
function sizingFor({
  sizing,
  units,
  gpuRange,
  resources,
  totalGpus,
}: {
  sizing: ResourceSizing | undefined;
  units: number;
  gpuRange: GpuRange | null;
  resources: EnvResources;
  totalGpus: number;
}): ResourceSizing | undefined {
  if (sizing?.mode !== 'pinned') {
    return sizing;
  }
  const { slice = [], ...pinned } = sizing;
  const floor = sizing.floor ?? { cpu: 0, ram: 0, disk: 0 };
  const recommendedUnits = gpuRange?.recommended ?? 0;
  const amount = (key: keyof ResourceAmounts) => {
    if (slice.includes(key)) {
      return sliceFor(resources[key], units, totalGpus);
    }
    if (recommendedUnits > 0 && units < recommendedUnits) {
      return Math.max(floor[key], Math.round((sizing[key] * units) / recommendedUnits));
    }
    return sizing[key];
  };
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

/** `units` of one GPU type (or none) on one candidate; null when the env can't host that right now. */
function evaluate<T extends QuickStartEntry>({
  candidate,
  types,
  gpuKey,
  units,
  gpuRange,
  envResources,
  durationSeconds,
}: {
  candidate: QuickStartCandidate<T>;
  types: MergedGpu[];
  gpuKey: string | null;
  units: number;
  gpuRange: GpuRange | null;
  /** The environment's CPU/RAM/disk/GPUs as read for this token, for the GPU slice of `slice` resources. */
  envResources: EnvResources;
  durationSeconds: number;
}): QuickStartOption<T> | null {
  const { environment, token } = candidate;
  const gpuSelection: GpuSelection = Object.fromEntries(types.map((t) => [t.key, t.key === gpuKey ? units : 0]));
  const sizing = sizingFor({
    sizing: candidate.entry.env.sizing,
    units,
    gpuRange,
    resources: envResources,
    totalGpus: totalUnitsOf(types),
  });
  const result = computeInferenceAllocation({
    environment,
    tokenAddress: token.address,
    gpuSelection,
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
  // The two checks an env card runs on Continue: free units behind every GPU id, and the shared
  // CPU/RAM/disk still free at the amounts this pick is priced on.
  const resources = environment.resources ?? [];
  try {
    buildGpuRequests(resources, result.selectedByKey);
    assertAllocationAvailable(resources, result.allocation);
  } catch {
    return null;
  }
  // The allocation clamps to what the env can grant, which may be under the declared minimum: the
  // target can't run on that.
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
    sizing,
    allocation: result.allocation,
    fullSizing,
    price: result.price,
  };
}

/**
 * The best pick on one environment: the most GPU units in [min, recommended] it can host right now.
 * Units of two GPU types are never mixed (a multi-GPU model shards across identical devices); when
 * several types can host the same count, the cheapest wins.
 */
function bestFitOn<T extends QuickStartEntry>({
  candidate,
  gpuRange,
  allowZeroGpu,
  durationSeconds,
}: {
  candidate: QuickStartCandidate<T>;
  gpuRange: GpuRange | null;
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

  // No GPUs in this environment: it hosts only a target that needs none.
  if (types.length === 0) {
    if ((gpuRange?.min ?? 0) > 0) {
      return null;
    }
    return evaluate({ candidate, types, gpuKey: null, units: 0, gpuRange, envResources: resources, durationSeconds });
  }

  // Zero units only where the flow permits it (templates) AND every GPU type of the env allows it,
  // the same gate the env card applies. Otherwise a GPU environment is booked in whole units.
  const floor = allowZeroGpu && types.every((t) => t.allowsZero) ? 0 : 1;
  // A target declaring no GPU wants as few as possible; one declaring a range, the recommended count.
  const low = Math.max(gpuRange?.min ?? floor, floor);
  const high = Math.max(gpuRange?.recommended ?? floor, low);
  for (let units = high; units >= low; units--) {
    if (units === 0) {
      const option = evaluate({
        candidate,
        types,
        gpuKey: null,
        units: 0,
        gpuRange,
        envResources: resources,
        durationSeconds,
      });
      if (option) {
        return option;
      }
      continue;
    }
    const options = types
      .filter((t) => t.available >= units)
      .map((t) =>
        evaluate({ candidate, types, gpuKey: t.key, units, gpuRange, envResources: resources, durationSeconds })
      )
      .filter((option): option is QuickStartOption<T> => option !== null)
      .sort((a, b) => Number(b.fullSizing) - Number(a.fullSizing) || a.price - b.price);
    if (options.length > 0) {
      return options[0];
    }
  }
  return null;
}

/**
 * Closest to the target GPU count, then the full recommended CPU/RAM/disk, then verified, then cheaper,
 * then the higher benchmark score. The sizing ranks above price: an env short of the recommendation is
 * cheaper exactly because it books less.
 */
function compareOptions<T extends QuickStartEntry>(target: number) {
  return (a: QuickStartOption<T>, b: QuickStartOption<T>): number => {
    const distance = Math.abs(target - a.gpuCount) - Math.abs(target - b.gpuCount);
    if (distance !== 0) {
      return distance;
    }
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
    return score(b) - score(a);
  };
}

export function planQuickStart<T extends QuickStartEntry>({
  candidates,
  gpuRange,
  allowZeroGpu,
  durationSeconds,
}: {
  candidates: QuickStartCandidate<T>[];
  /** Null when the target declares no GPU (it then books as few as the environment allows). */
  gpuRange: GpuRange | null;
  /** Whether the flow permits a zero-GPU pick at all: templates yes, packages no. */
  allowZeroGpu: boolean;
  durationSeconds: number;
}): QuickStartPlan<T> {
  const fitting: QuickStartOption<T>[] = [];
  // Hosting doesn't depend on the session length, only the price does, so an environment that fits
  // but not this length still tells the user which length would work.
  let suggestionSeconds: number | null = null;
  for (const candidate of candidates) {
    const option = bestFitOn({ candidate, gpuRange, allowZeroGpu, durationSeconds });
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
    fitting.sort(compareOptions(gpuRange?.recommended ?? 0));
    return { status: 'ready', option: fitting[0] };
  }
  if (suggestionSeconds !== null) {
    return { status: 'duration', suggestionSeconds };
  }
  return { status: 'none' };
}
