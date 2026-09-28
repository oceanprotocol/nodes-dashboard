import { GpuSelection, ResourceSizing } from '@/components/hooks/use-inference-allocation';
import { fetchNodeEnvironment } from '@/components/hooks/use-live-env';
import { SelectedToken } from '@/context/run-job-context';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import {
  envKey,
  GpuRange,
  planQuickStart,
  QuickStartEntry,
  QuickStartOption,
  toCandidates,
} from '@/services/quick-start';
import { ComputeEnvironment } from '@/types/environments';
import { checkEnvAccess, hasAccessRestriction } from '@/utils/check-env-access';
import { formatDuration, formatTokenAmount, roundTokenAmount } from '@/utils/formatters';
import { ethers } from 'ethers';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';

/**
 * Node reads one Start may spend confirming candidates. Each is a P2P dial, so this bounds how long a
 * click can take when the listed availability is badly out of date; whatever is left unconfirmed is
 * still offered, and the next click carries on from there.
 */
const MAX_NODE_READS = 4;

export type QuickStartStatus = 'loading' | 'error' | 'ready' | 'duration' | 'none' | 'denied';

/** A confirmed quick-start pick, as handed to the page that commits it. */
export type QuickStartPick<T extends QuickStartEntry> = {
  entry: T;
  token: SelectedToken;
  gpuSelection: GpuSelection;
  environment: ComputeEnvironment;
  sizing: ResourceSizing | undefined;
};

export type QuickStart<T extends QuickStartEntry> = {
  status: QuickStartStatus;
  /** What Start would launch on right now, when `status` is `ready`. */
  option: QuickStartOption<T> | null;
  /** The option's price in its fee token, e.g. "12.4 USDC". */
  priceLabel: string | null;
  /** Why Start can't be pressed (its tooltip), or null when it can. */
  blockedReason: string | null;
  /** A session length some fitting environment accepts, when the current one is what blocks Start. */
  suggestedDurationSeconds: number | null;
  /** The target's recommended GPU count when the option books fewer (the rest aren't free). */
  recommendedGpus: number | null;
  /** The option books less CPU/RAM/disk than recommended: no fitting environment has that much free. */
  belowRecommendedResources: boolean;
  loadError: string | null;
  retry: () => void;
  start: () => void;
  starting: boolean;
  /** No wallet yet: Start opens the login, since access lists and payment both need one. */
  needsLogin: boolean;
};

/** checkEnvAccess, with a failed on-chain read reported as unknown instead of thrown. */
async function accessFor(
  environment: ComputeEnvironment,
  address: string | undefined,
  provider: ethers.ContractRunner | null
): Promise<boolean | null> {
  try {
    return await checkEnvAccess(environment.access, address, provider);
  } catch (error) {
    console.error('Failed to check environment access:', error);
    return null;
  }
}

function priceLabelOf<T extends QuickStartEntry>(option: QuickStartOption<T>): string {
  const { address, symbol } = option.candidate.token;
  return `${formatTokenAmount(option.price, address)} ${symbol}`.trim();
}

function describePick<T extends QuickStartEntry>(option: QuickStartOption<T>): string {
  return option.gpuCount > 0 ? `${option.gpuCount}× ${option.gpuLabel}` : 'a CPU-only environment';
}

/**
 * Drives a details modal's quick start: plans the best environment for the target from what the
 * resolver listed (see planQuickStart), and on Start confirms it against the node itself before
 * handing it on: the listed `inUse` comes from the backend's cached index and can be out of date.
 *
 * Start walks the plan: it re-reads the top candidate from its node and re-plans with the node's own
 * numbers, until the plan settles on an environment whose copy was just read (confirmed free), or runs
 * out of candidates or reads. A candidate the node no longer lists is dropped for this modal; one that
 * is busy stays, planned against its fresh copy (it may still host fewer GPUs); an unreachable one is
 * only skipped for this click. When the confirmed pick books fewer GPUs, costs more or charges another
 * token than the button showed, Start stops and shows it rather than carrying the user on to a payment
 * they didn't see.
 */
export default function useQuickStart<T extends QuickStartEntry>({
  entries,
  loading,
  loadError,
  retry,
  gpuRange,
  allowZeroGpu,
  durationSeconds,
  onStart,
}: {
  entries: T[];
  loading: boolean;
  loadError: string | null;
  retry: () => void;
  /** Memoize it: a new object per render re-plans every render. */
  gpuRange: GpuRange | null;
  allowZeroGpu: boolean;
  durationSeconds: number;
  /**
   * Commit the confirmed pick. `environment` is the node's own copy it was confirmed against,
   * `gpuSelection` names every GPU type of it, and `sizing` is what the pick was priced on. Pass all
   * of them on as-is.
   */
  onStart: (pick: QuickStartPick<T>) => void;
}): QuickStart<T> {
  const { account, provider, login } = useOceanAccount();
  const { getEnvs, isReady } = useP2P();

  // What earlier Starts learned, keyed by envKey: the node's fresh copies, and the entries it no longer
  // offers (an access list refusing the wallet lands in `access`). Only true of these entries: a refetch
  // starts over.
  const [fresh, setFresh] = useState<Record<string, ComputeEnvironment>>({});
  const [excluded, setExcluded] = useState<Record<string, true>>({});
  const [access, setAccess] = useState<Record<string, boolean | null>>({});
  const [starting, setStarting] = useState(false);
  // Start stays mounted across its node reads, and a second click must not run a second walk.
  const startingRef = useRef(false);

  useEffect(() => {
    setFresh({});
    setExcluded({});
  }, [entries]);

  // Access lists are checked up front so the plan never offers an environment the wallet can't use:
  // the node would refuse the serviceStart with 403 only after the escrow deposit. Unrestricted envs
  // resolve at once; without a wallet every check is `null` (unknown), and Start logs in first.
  useEffect(() => {
    let cancelled = false;
    // Results for another wallet (or other entries) don't carry over: until these settle it's pending.
    setAccess({});
    Promise.all(
      entries.map(
        async (entry) => [envKey(entry.env), await accessFor(entry.env.environment, account.address, provider)] as const
      )
    ).then((pairs) => {
      if (!cancelled) {
        setAccess(Object.fromEntries(pairs));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entries, account.address, provider]);

  // Without a wallet no access list can be checked, so a plan over every entry could quote an
  // environment most wallets can't use and change the moment the user logs in. Plan on the open ones
  // first, and fall back to the restricted ones only when nothing open fits.
  const plan = useMemo(() => {
    const planOn = (list: T[]) =>
      planQuickStart({
        candidates: toCandidates({ entries: list, fresh, excluded, access }),
        gpuRange,
        allowZeroGpu,
        durationSeconds,
      });
    if (!account.address) {
      const open = planOn(entries.filter((entry) => !hasAccessRestriction(entry.env.environment.access)));
      if (open.status === 'ready') {
        return open;
      }
    }
    return planOn(entries);
  }, [entries, fresh, excluded, access, gpuRange, allowZeroGpu, durationSeconds, account.address]);

  const start = useCallback(async () => {
    if (plan.status !== 'ready' || startingRef.current) {
      return;
    }
    if (!account.address) {
      login();
      return;
    }
    if (!isReady) {
      toast.error("Still connecting to the network, so availability can't be checked yet. Try again in a moment.");
      return;
    }
    const shown = plan.option;
    startingRef.current = true;
    setStarting(true);

    const nextFresh = { ...fresh };
    const nextExcluded = { ...excluded };
    // Access results seen during this click, kept with the up-front ones so a refusal shows as one.
    const nextAccess = { ...access };
    // Skipped for this click only: the node didn't answer, or the access list couldn't be read. Tried
    // again on the next click on purpose: a node that timed out may answer now, and one that never
    // does couldn't be launched on anyway (the payment step needs it reachable too).
    const skipped: Record<string, true> = {};
    // Read from the node during this click: a plan that lands on one of these is confirmed.
    const confirmed = new Set<string>();
    let reads = 0;
    let unreachable = false;
    let accessUnknown = false;
    let denied = false;
    const replan = (withSkipped: boolean) =>
      planQuickStart({
        candidates: toCandidates({
          entries,
          fresh: nextFresh,
          excluded: withSkipped ? { ...nextExcluded, ...skipped } : nextExcluded,
          access: nextAccess,
        }),
        gpuRange,
        allowZeroGpu,
        durationSeconds,
      });

    try {
      for (;;) {
        const current = replan(true);
        if (current.status !== 'ready') {
          break;
        }
        const option = current.option;
        const { key, entry } = option.candidate;

        if (confirmed.has(key)) {
          setFresh(nextFresh);
          setExcluded(nextExcluded);
          setAccess(nextAccess);
          const sameToken = option.candidate.token.address === shown.candidate.token.address;
          const pricier =
            !sameToken ||
            roundTokenAmount(option.price, option.candidate.token.address, 'up') >
              roundTokenAmount(shown.price, shown.candidate.token.address, 'up');
          if (option.gpuCount !== shown.gpuCount || pricier) {
            // Now shown on the button, so the user decides with the real numbers in front of them.
            toast.info(
              `Availability changed since this loaded. The best match is now ${describePick(option)} for ${priceLabelOf(option)}. Press Start to continue.`
            );
            return;
          }
          if (key !== shown.candidate.key) {
            const node = entry.env.nodeInfo.friendlyName || entry.env.nodeInfo.id;
            toast.info(`Your first match was just booked, so this starts on ${node} instead.`);
          }
          onStart({
            entry,
            token: option.candidate.token,
            gpuSelection: option.gpuSelection,
            environment: option.candidate.environment,
            sizing: option.sizing,
          });
          return;
        }

        if (reads >= MAX_NODE_READS) {
          break;
        }
        const allowed = await accessFor(option.candidate.environment, account.address, provider);
        if (allowed === false) {
          denied = true;
          nextAccess[key] = false;
          continue;
        }
        if (allowed === null) {
          accessUnknown = true;
          skipped[key] = true;
          continue;
        }
        reads += 1;
        const read = await fetchNodeEnvironment({
          getEnvs,
          nodeInfo: entry.env.nodeInfo,
          envId: option.candidate.environment.id,
        });
        if (!read.reached) {
          unreachable = true;
          skipped[key] = true;
          continue;
        }
        if (!read.env) {
          // The node answered without this environment: it won't come back by retrying.
          nextExcluded[key] = true;
          continue;
        }
        // Re-plan on the node's own numbers: busy units drop this env to fewer GPUs, or out entirely.
        nextFresh[key] = read.env;
        confirmed.add(key);
      }

      setFresh(nextFresh);
      setExcluded(nextExcluded);
      setAccess(nextAccess);
      if (replan(false).status === 'ready') {
        if (unreachable) {
          toast.info(
            "Some nodes didn't answer, so their availability couldn't be confirmed. Press Start to try again."
          );
        } else if (accessUnknown) {
          toast.info("Your access to some environments couldn't be checked. Press Start to try again.");
        } else {
          toast.info('The environments checked so far were just booked. Press Start to try the next best match.');
        }
      } else if (denied && confirmed.size === 0) {
        toast.error("Your wallet isn't on the access list of any environment that fits.");
      } else {
        toast.error(
          'Everything that fits was just booked. Try again shortly, or pick an environment yourself under Advanced setup.'
        );
      }
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [
    plan,
    account.address,
    login,
    isReady,
    fresh,
    excluded,
    entries,
    access,
    gpuRange,
    allowZeroGpu,
    durationSeconds,
    provider,
    getEnvs,
    onStart,
  ]);

  const option = plan.status === 'ready' ? plan.option : null;
  const suggestedDurationSeconds = plan.status === 'duration' ? plan.suggestionSeconds : null;

  // The access checks resolve after the entries: until each has, the plan may still offer an
  // environment the wallet will turn out to be refused on, so it isn't shown yet.
  const accessPending = entries.some((entry) => !(envKey(entry.env) in access));

  let status: QuickStartStatus;
  if (loading || (!loadError && accessPending)) {
    status = 'loading';
  } else if (loadError) {
    status = 'error';
  } else if (plan.status === 'ready') {
    status = 'ready';
  } else if (plan.status === 'duration') {
    status = 'duration';
  } else if (entries.length > 0 && entries.every((entry) => access[envKey(entry.env)] === false)) {
    status = 'denied';
  } else {
    status = 'none';
  }

  const blockedReasons: Record<QuickStartStatus, string | null> = {
    loading: 'Finding a free environment…',
    error: "Environments couldn't be loaded. Retry above.",
    ready: null,
    duration:
      suggestedDurationSeconds !== null
        ? `No environment that fits takes ${formatDuration(durationSeconds)}. Try ${formatDuration(suggestedDurationSeconds)}.`
        : null,
    none: 'No environment can run this right now.',
    denied: "Your wallet isn't on the access list of any environment that fits.",
  };

  return {
    status,
    option,
    priceLabel: option ? priceLabelOf(option) : null,
    blockedReason: blockedReasons[status],
    suggestedDurationSeconds,
    recommendedGpus: option && gpuRange && option.gpuCount < gpuRange.recommended ? gpuRange.recommended : null,
    belowRecommendedResources: !!option && !option.fullSizing,
    loadError,
    retry,
    start,
    starting,
    needsLogin: !account.address,
  };
}
