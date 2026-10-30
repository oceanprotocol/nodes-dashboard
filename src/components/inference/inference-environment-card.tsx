import BenchmarkSummary from '@/components/benchmarks/benchmark-summary';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import useInferenceAllocation, {
  GpuRequest,
  GpuSelection,
  ResourceSizing,
} from '@/components/hooks/use-inference-allocation';
import useLiveEnv from '@/components/hooks/use-live-env';
import Select from '@/components/input/select';
import { getSupportedTokens } from '@/constants/tokens';
import { useTokensSymbols, useTokenSymbol } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { assertAllocationAvailable, gpuSelectionMessage } from '@/services/inference-launch';
import { bookedVramGb, vramFitMessage, vramShortfallMessage } from '@/services/vram-estimate';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { checkEnvAccess } from '@/utils/check-env-access';
import {
  DeclaredRequirement,
  demandOf,
  GpuDemand,
  gpuFeesOf,
  gpuPickerModel,
  GpuPlan,
  gpuPriceOf,
  GpuRequirement,
  gpuResourcesOf,
  NO_GPU_PLAN,
  planOf,
  sameGpuPrice,
  selectionOfRequests,
  validatePlanFor,
} from '@/utils/env-resources';
import { getEnvSupportedTokens } from '@/utils/env-tokens';
import { formatDuration, formatGb, formatTokenAmount } from '@/utils/formatters';
import { serviceDurationBounds } from '@/utils/service-duration';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Tooltip } from '@mui/material';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './inference-environment-card.module.css';

type InferenceEnvironmentCardProps = {
  environment: ComputeEnvironment;
  nodeInfo: EnvNodeInfo;
  durationSeconds: number;
  /** Token address selected in the filters — when supported, it's forced and the token select is hidden. */
  defaultToken?: string;
  selected?: boolean;
  /**
   * Commit the pick. `environment` is the copy this card actually priced the selection against —
   * the node's own, once a live read succeeded — so the caller stores (and later launches from)
   * the same availability the user saw, not the cached list entry.
   */
  onSelect?: (
    tokenAddress: string,
    tokenSymbol: string,
    gpuSelection: GpuSelection,
    environment: ComputeEnvironment,
    /** The exact GPU ids picked and their per-minute price, re-checked on `environment` just now. */
    gpuPlan: GpuPlan
  ) => void;
  /** Reports the current fee token (address + symbol) on settle/switch — lets a read-only card (no
   * `onSelect`) still surface the user's token pick. */
  onTokenChange?: (tokenAddress: string, tokenSymbol: string) => void;
  /**
   * When set, force-disables the select button and shows this as its tooltip reason (e.g. the shared
   * duration is out of this env's bounds). Adds to the card's own block reasons.
   */
  disabledReason?: string;
  /**
   * Units per GPU type to use. Uncontrolled when omitted (card owns its selection via the chips);
   * pass a value to render a fixed selection read-only (e.g. the selection summary).
   */
  gpuSelection?: GpuSelection;
  /** With a controlled `gpuSelection`: the exact GPU ids it books, so the price shown is theirs. */
  gpuRequests?: GpuRequest[];
  /**
   * Seeds the chips when the card is uncontrolled (e.g. restoring a prior pick for this env) — used only
   * when it is still one bookable group; otherwise the planner's cheapest candidate is the default.
   */
  initialSelection?: GpuSelection;
  /**
   * How to size/display/price the shared CPU/RAM/disk: `pinned` fixed amounts (quick start), a `floor`
   * under the GPU-fraction slice (advanced handoff), or the `exact` amounts a running service booked
   * (manage page). Omit for the proportional slice. See {@link ResourceSizing}.
   */
  sizing?: ResourceSizing;
  /**
   * The launch target's recommended resources (a template's or package's `recommendedResources`) — its
   * GPU entry decides which (group, count) bookings are offered (the planner's candidates). Ignored when
   * `gpuDemand` is passed.
   */
  declaredRequirements?: DeclaredRequirement[];
  /**
   * What the GPUs must satisfy, when it isn't a declared requirement — the custom-model flow passes its
   * memory estimate (`vram`) or, without one / with "show all", its legal tensor-parallel widths (`units`).
   */
  gpuDemand?: GpuDemand;
  /** Offer only the layout of this many cards — a package's pinned tensor-parallel width. */
  forcedGpuCount?: number;
  /** Estimated VRAM (GB) a custom model needs; the card warns when the picked group's cards carry less. */
  modelVramGb?: number;
  /** A custom model's estimated layouts: the card warns (never blocks) when the active pick doesn't fit them. */
  advisoryRequirement?: GpuRequirement;
  /**
   * Whether a 0-unit pick is offerable at all on this card. Defaults to false, preserving today's
   * behavior exactly ("select at least one GPU unit to continue"). Even when true, zero only actually
   * appears on a type's row the env itself lets you book none of (`MergedGpu.allowsZero`) — an env whose
   * GPU resources require at least one unit keeps blocking zero regardless of this flag. Set true only for the template flows (details page + Advanced env picker
   * in Template mode); custom-model, default-model, and quick-start-package flows must keep the
   * existing hard floor of 1, so this stays false there.
   */
  allowZeroGpu?: boolean;
  /**
   * Hide the price. Set on a card that summarises a launch which costs nothing — an Edit relaunch
   * reuses the running service's already-paid window (serviceRestart keeps the same expiry and never
   * touches escrow), so quoting this env's rate would name a charge that is never made.
   */
  hidePrice?: boolean;
};

const InferenceEnvironmentCard: React.FC<InferenceEnvironmentCardProps> = ({
  environment: listedEnvironment,
  nodeInfo,
  durationSeconds,
  hidePrice,
  defaultToken,
  selected = false,
  onSelect,
  onTokenChange,
  disabledReason,
  gpuSelection: controlledSelection,
  gpuRequests: controlledRequests,
  initialSelection,
  sizing,
  declaredRequirements,
  gpuDemand,
  forcedGpuCount,
  modelVramGb,
  advisoryRequirement,
  allowZeroGpu = false,
}) => {
  const { account, provider } = useOceanAccount();

  // The listed env comes from the cached `/envs` index, so its `inUse` — hence which GPU ids the
  // chips offer and the launch will name — can already be wrong when the card renders. Re-read it
  // from the node on the first chip click and again on Continue; everything below then works off
  // the node's own copy (or the cached one, unchanged, when the node can't be reached).
  const { env: liveEnvironment, refresh: refreshLiveEnv } = useLiveEnv(listedEnvironment, nodeInfo);
  const environment = liveEnvironment ?? listedEnvironment;

  // Inference is always paid (never the env's `free` tier), so only the paid access list applies.
  // null = wallet not connected yet (or an access-list read that needs a provider) — distinct from
  // false (connected, but not allowed), which the node would reject at serviceStart with 403.
  const [paidAccess, setPaidAccess] = useState<boolean | null>(null);

  useEffect(() => {
    checkEnvAccess(environment.access, account.address, provider).then(setPaidAccess);
  }, [environment.access, account.address, provider]);

  const supportedTokens = useMemo(() => getEnvSupportedTokens(environment, true), [environment]);
  const supportedTokensSymbols = useTokensSymbols(supportedTokens);

  // Filter token wins when supported; otherwise USDC, otherwise the first supported paid token.
  const tokenForced = !!defaultToken && supportedTokens.some((t) => t.toLowerCase() === defaultToken.toLowerCase());
  const getDefaultToken = useCallback(() => {
    if (defaultToken && supportedTokens.some((t) => t.toLowerCase() === defaultToken.toLowerCase())) {
      return defaultToken;
    }
    const usdc = getSupportedTokens().USDC.address;
    if (supportedTokens.some((t) => t.toLowerCase() === usdc.toLowerCase())) {
      return usdc;
    }
    return supportedTokens[0] ?? usdc;
  }, [defaultToken, supportedTokens]);

  const [tokenAddress, setTokenAddress] = useState<string>(getDefaultToken());
  const fetchedTokenSymbol = useTokenSymbol(tokenAddress);
  const tokenSymbol = fetchedTokenSymbol ?? supportedTokensSymbols[tokenAddress] ?? null;

  useEffect(() => {
    setTokenAddress(getDefaultToken());
  }, [getDefaultToken]);

  // Waits for the symbol so the parent never gets an address with an empty symbol.
  useEffect(() => {
    if (tokenAddress && tokenSymbol) {
      onTokenChange?.(tokenAddress, tokenSymbol);
    }
  }, [tokenAddress, tokenSymbol, onTokenChange]);

  const isControlled = controlledSelection !== undefined;

  // What this launch asks of the GPUs (template/package VRAM requirement, a custom model's estimate or
  // legal widths, or nothing). Every count offered, the default and the ids booked come from the
  // planner (env-resources → vendored ocean.js planGpuLayouts), never from a local fit rule.
  const demand: GpuDemand = useMemo(
    () => gpuDemand ?? demandOf(declaredRequirements),
    [gpuDemand, declaredRequirements]
  );
  const gpuFees = useMemo(() => gpuFeesOf(environment, tokenAddress), [environment, tokenAddress]);
  const envHasGpus = useMemo(() => gpuResourcesOf(environment).length > 0, [environment]);

  /**
   * The card's own pick: ONE group and a card count (count 0 = no GPU). Selecting a count on a group
   * zeroes every other group — cards of two types are never booked together. `userPicked` separates a
   * click from the automatic seed, which may re-seed itself when availability moves under it.
   */
  const [pick, setPick] = useState<{ groupKey: string | null; count: number; userPicked: boolean } | null>(null);
  // A different demand (a custom model's estimate landing, the "show all" toggle) re-seeds the pick.
  const demandKey = JSON.stringify([demand, forcedGpuCount ?? null]);
  const [pickDemandKey, setPickDemandKey] = useState(demandKey);
  if (pickDemandKey !== demandKey) {
    setPickDemandKey(demandKey);
    setPick(null);
  }

  // Candidates for every (group, count), ignoring the shared-resource budget — ids don't depend on it.
  const pickerAll = useMemo(
    () => gpuPickerModel({ environment, demand, fees: gpuFees, forcedGpuCount, unitBudget: Number.POSITIVE_INFINITY }),
    [environment, demand, gpuFees, forcedGpuCount]
  );
  const pickedCandidate =
    pick && pick.count > 0 && pick.groupKey !== null
      ? pickerAll.groups.find((g) => g.key === pick.groupKey)?.live.get(pick.count)
      : undefined;
  // The exact plan behind the pick: no GPU for a zero pick, the planner's ids otherwise; null while the
  // picked count isn't bookable (busy, or not a candidate any more).
  // An env without GPUs books none.
  const gpuPlan: GpuPlan | null = !envHasGpus
    ? NO_GPU_PLAN
    : !pick
      ? null
      : pick.count === 0
        ? NO_GPU_PLAN
        : pickedCandidate
          ? planOf(pickedCandidate)
          : null;
  const ownSelection = useMemo<GpuSelection>(() => {
    const zero = selectionOfRequests(environment, []);
    if (pick && pick.groupKey !== null && pick.count > 0) {
      zero[pick.groupKey] = pick.count;
    }
    return zero;
  }, [environment, pick]);

  const {
    mergedGpus,
    maxByKey,
    maxUnitsByResources,
    selectedByKey,
    selectedTotal,
    allocation,
    price,
    hasGpus,
    gpuExhausted,
    constraintViolation,
  } = useInferenceAllocation({
    environment,
    tokenAddress,
    gpuSelection: isControlled ? controlledSelection : ownSelection,
    // Controlled: price the ids the caller booked. Own pick: price the planner's ids for it.
    gpuRequests: isControlled ? controlledRequests : (gpuPlan?.requests ?? undefined),
    sizing,
    durationSeconds,
  });

  // Zero GPUs only for a target with no GPU requirement, in a flow that allows it, on an env whose every
  // GPU group allows booking none (min 0).
  const zeroAllowed = allowZeroGpu && hasGpus && demand.kind === 'none' && mergedGpus.every((g) => g.allowsZero);

  // The same planner, now bounded by what the free CPU/RAM/disk can back: its first candidate is the
  // cheapest valid booking (fewer cards on a tie) — the default.
  const pickerNow = useMemo(
    () => gpuPickerModel({ environment, demand, fees: gpuFees, forcedGpuCount, unitBudget: maxUnitsByResources }),
    [environment, demand, gpuFees, forcedGpuCount, maxUnitsByResources]
  );

  // Seed once the groups are known: a prior pick for this env when it is still one bookable group, else
  // zero where zero is the target's own choice, else the planner's best candidate. Never "every free unit".
  useEffect(() => {
    if (isControlled || pick !== null || !hasGpus) {
      return;
    }
    const prior = Object.entries(initialSelection ?? {}).filter(([, n]) => n > 0);
    if (prior.length === 1) {
      const [groupKey, count] = prior[0];
      const group = pickerNow.groups.find((g) => g.key === groupKey);
      if (group?.live.has(count)) {
        setPick({ groupKey, count, userPicked: true });
        return;
      }
    }
    if (zeroAllowed) {
      setPick({ groupKey: null, count: 0, userPicked: false });
      return;
    }
    const best = pickerNow.best;
    setPick(
      best
        ? { groupKey: best.groupKey, count: best.layout?.gpuCount ?? 0, userPicked: false }
        : { groupKey: null, count: 0, userPicked: false }
    );
  }, [isControlled, pick, hasGpus, initialSelection, pickerNow, zeroAllowed]);

  // An automatic seed that a live read made unbookable re-seeds; a user's own pick stays (blocked, with
  // the reason) so it never silently jumps to another GPU type.
  useEffect(() => {
    if (pick && !pick.userPicked && pick.count > 0 && !pickedCandidate) {
      setPick(null);
    }
  }, [pick, pickedCandidate]);

  const editable = !isControlled && !!onSelect;

  // Paid service-on-demand duration window (inference always uses a paid token → top-level bounds).
  // Shown next to the select button so the user knows the valid range.
  const durationRangeText = useMemo(() => {
    const { min, max } = serviceDurationBounds(environment);
    if (min && Number.isFinite(max)) {
      return `${formatDuration(min)} – ${formatDuration(max)}`;
    }
    if (min) {
      return `min ${formatDuration(min)}`;
    }
    if (Number.isFinite(max)) {
      return `max ${formatDuration(max)}`;
    }
    return null;
  }, [environment]);

  const choose = (groupKey: string | null, count: number) => {
    setPick({ groupKey: count > 0 ? groupKey : null, count, userPicked: true });
    // The user is committing to a count — make sure the units behind it are really free. Rate-limited
    // and coalesced inside the hook, so a 1x → 2x → 4x burst costs one read.
    void refreshLiveEnv();
  };

  // Advisory only (custom models): does the active group's pick hold the model's estimated need? Uses
  // the estimate's own layouts when there is one, else the coarse total — never VRAM of other groups.
  const vramWarning = useMemo(() => {
    const count = isControlled ? selectedTotal : (pick?.count ?? 0);
    if (advisoryRequirement && count > 0) {
      const requests = isControlled ? (controlledRequests ?? []) : (gpuPlan?.requests ?? []);
      if (requests.length === 0) {
        return null;
      }
      const check = validatePlanFor({
        environment,
        demand: { kind: 'vram', requirement: advisoryRequirement },
        plan: { requests, gpuPrice: 0 },
      });
      return check.ok ? null : vramFitMessage(advisoryRequirement, count, bookedVramGb(environment, selectedByKey));
    }
    return modelVramGb ? vramShortfallMessage(modelVramGb, bookedVramGb(environment, selectedByKey)) : null;
  }, [
    advisoryRequirement,
    modelVramGb,
    environment,
    selectedByKey,
    isControlled,
    selectedTotal,
    pick,
    gpuPlan,
    controlledRequests,
  ]);

  const computeText = [
    allocation.cpu > 0 && `${allocation.cpu} CPU`,
    allocation.ram > 0 && `${formatGb(allocation.ram)} RAM`,
    allocation.disk > 0 && `${formatGb(allocation.disk)} disk`,
  ]
    .filter(Boolean)
    .join(' · ');

  const requirementGb = demand.kind === 'vram' ? demand.requirement.recommended : null;

  const renderGpuTypes = () => {
    if (!hasGpus) {
      return null;
    }
    return mergedGpus.map((gpu) => {
      const chosen = selectedByKey[gpu.key] ?? 0;
      const group = pickerAll.groups.find((g) => g.key === gpu.key);
      // Counts offered as buttons: what the planner could ever book on this group (busy ones render
      // disabled, never removed), plus 0 when the target may run without a GPU.
      const options = [...(zeroAllowed ? [0] : []), ...(group?.offered ?? [])];
      const label = <HardwareLabel className={styles.gpuLabel} type="gpu" value={gpu.description || 'GPU'} />;
      if (!editable) {
        return (
          <div className={styles.gpuType} key={gpu.key}>
            {label}
            <span className={classNames('chip', 'chipAccent2', styles.countStatic)}>
              {chosen} / {gpu.max} selected
            </span>
          </div>
        );
      }
      if (options.length === 0) {
        return (
          <div className={styles.gpuType} key={gpu.key}>
            {label}
            <span className={classNames('chip', 'chipGlass', styles.countStatic)}>
              {demand.kind === 'vram' && gpu.vramGb === undefined
                ? 'VRAM not reported'
                : requirementGb !== null
                  ? `Can't hold ${formatGb(requirementGb)} VRAM`
                  : 'Not bookable'}
            </span>
          </div>
        );
      }
      const active = pick !== null && pick.groupKey === gpu.key && pick.count > 0;
      return (
        <div className={styles.gpuType} key={gpu.key}>
          {label}
          <div className={styles.counts}>
            {/* One group at a time: picking a count here zeroes every other row. Counts that can't be
                booked right now stay visible, disabled, with the reason in a tooltip. */}
            {options.map((n) => {
              const liveNow = n === 0 || !!group?.live.has(n);
              const disabled = n > 0 && (!liveNow || n > maxUnitsByResources);
              const isChosen = n === 0 ? pick !== null && pick.count === 0 : active && pick?.count === n;
              const button = (
                <Button
                  color="accent1"
                  disabled={disabled}
                  onClick={() => choose(gpu.key, n)}
                  size="xs"
                  variant={isChosen ? 'filled' : 'outlined'}
                >
                  {n}x
                </Button>
              );
              const disabledReason =
                n > gpu.available
                  ? 'This many units are currently in use.'
                  : n > maxUnitsByResources
                    ? 'Not enough shared CPU/ RAM/ disk to back this many units right now.'
                    : "These GPUs can't be booked together right now (reserved or pooled units).";
              return disabled ? (
                // Disabled buttons emit no pointer/focus events — focusable span (tabIndex +
                // aria-label) keeps the tooltip reason reachable by keyboard and screen readers.
                <Tooltip key={n} title={disabledReason}>
                  <span tabIndex={0} aria-label={`${n}x: ${disabledReason}`}>
                    {button}
                  </span>
                </Tooltip>
              ) : (
                <span key={n}>{button}</span>
              );
            })}
            {!active && !zeroAllowed && (
              <span className={classNames('chip', 'chipGlass', styles.countStatic)}>none</span>
            )}
          </div>
        </div>
      );
    });
  };

  // Reason the env can't be selected right now: a caller-supplied block (e.g. duration out of bounds)
  // wins, then the wallet/access gate — the node enforces the env's access list at serviceStart (403
  // 'Access denied'), so block here rather than after the user has paid escrow — then GPU-only cases,
  // then a cross-resource constraint the built request would violate (the node would reject it).
  // Null → selectable. Drives the disabled state + tooltip.
  const accessBlockedReason =
    paidAccess === null
      ? 'You need to log in to continue.'
      : paidAccess
        ? null
        : "Your wallet address is not in this environment's access list.";
  const zeroSelected = !!pick && pick.count === 0 && zeroAllowed;
  // A declared GPU recommendation no group here can ever hold: no pick on this env can run the model.
  const noFittingLayout =
    demand.kind === 'vram' && hasGpus && pickerAll.groups.every((g) => g.offered.length === 0)
      ? `No GPU here can hold the recommended ${formatGb(demand.requirement.recommended)} of VRAM.`
      : null;
  // The pick must be exactly one valid layout of one group (the vendored plan validator), or zero GPUs
  // where the target allows that.
  const planReason = useMemo(() => {
    if (!hasGpus) {
      return demand.kind === 'vram' ? 'This environment has no GPU, and this launch needs one.' : null;
    }
    if (!pick) {
      return 'Select at least one GPU unit to continue.';
    }
    if (pick.count === 0) {
      return zeroSelected ? null : 'Select at least one GPU unit to continue.';
    }
    if (!gpuPlan) {
      return 'That many GPUs of this type can no longer be booked here. Pick another count.';
    }
    if (pick.count > maxUnitsByResources) {
      return 'Not enough shared CPU/ RAM/ disk to back this many units right now.';
    }
    const check = validatePlanFor({ environment, demand, plan: gpuPlan, forcedGpuCount });
    return check.ok === false ? check.reason : null;
  }, [hasGpus, pick, zeroSelected, gpuPlan, maxUnitsByResources, environment, demand, forcedGpuCount]);
  const selectBlockedReason =
    disabledReason ??
    accessBlockedReason ??
    noFittingLayout ??
    (hasGpus && gpuExhausted && !zeroSelected ? 'All GPU units in this environment are currently in use.' : null) ??
    planReason ??
    constraintViolation ??
    null;
  const selectDisabled = !tokenSymbol || !!selectBlockedReason;

  /**
   * Commit the pick against a freshly-read environment. The node is the only authority on which units
   * are free, and it rejects a serviceStart naming a taken GPU outright — so re-read first, re-check
   * the SAME planned ids (and their price) on it, and when they no longer hold, say so and let the user
   * pick again instead of carrying a doomed (or differently priced) selection into the payment step.
   */
  // The live read Continue forces is a node round trip, and the button stays mounted across it — a
  // second click would start a second dial and could commit the pick (and navigate) twice.
  const [committing, setCommitting] = useState(false);
  const handleContinue = async () => {
    if (selectDisabled || committing || !tokenSymbol || !onSelect || !gpuPlan) {
      return;
    }
    setCommitting(true);
    try {
      const read = await refreshLiveEnv(true);
      // Validate against the node's own numbers, and only a read made now: a failed dial (or one that
      // only had an earlier cached answer) would measure the snapshot against itself.
      if (!read.fresh || !read.env) {
        toast.error(
          read.reason === 'unidentified'
            ? 'This node is no longer offering the environment you picked. Go back and choose one again.'
            : "Couldn't reach the node to confirm these GPUs are still free. Check your connection and try again."
        );
        return;
      }
      const fresh = read.env;
      const check = envHasGpus ? validatePlanFor({ environment: fresh, demand, plan: gpuPlan, forcedGpuCount }) : null;
      if (check && check.ok === false) {
        toast.error(`These GPUs can no longer be booked: ${check.reason}. Pick again.`);
        return;
      }
      try {
        // The shared resources too, not just the GPU units — same assertion the launch runs.
        assertAllocationAvailable(fresh.resources ?? [], allocation);
      } catch (error) {
        toast.error(
          gpuSelectionMessage(error, 'in the meantime') ??
            'This environment can no longer host that selection. Adjust it and try again.'
        );
        return;
      }
      const freshPrice = gpuPriceOf(gpuPlan.requests, gpuFeesOf(fresh, tokenAddress));
      if (!sameGpuPrice(freshPrice, gpuPlan.gpuPrice)) {
        toast.error('The price of these GPUs just changed. Check the new price and press again.');
        return;
      }
      onSelect(tokenAddress, tokenSymbol, selectionOfRequests(fresh, gpuPlan.requests), fresh, {
        requests: gpuPlan.requests,
        gpuPrice: freshPrice,
      });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Card
      className={classNames(styles.card, { [styles.selectable]: !!onSelect, [styles.selected]: selected })}
      direction="column"
      innerShadow="black"
      padding="sm"
      radius="md"
      spacing="sm"
      variant={selected ? 'accent2' : 'glass-shaded'}
    >
      <div className={styles.nodeInfo}>
        <div className={styles.nodeNameWrapper}>
          Node:
          <span className={styles.nodeName}>
            <Button
              className={styles.nodeLink}
              color="accent1"
              href={`/nodes/${nodeInfo.id}`}
              size="link"
              target="_blank"
              variant="transparent"
            >
              {nodeInfo.friendlyName || nodeInfo.id}
            </Button>
            {nodeInfo.verified ? <VerifiedIcon className={styles.verified} /> : null}
          </span>
        </div>
        {nodeInfo.latestBenchmarkResults ? (
          <BenchmarkSummary
            cpuScore={nodeInfo.latestBenchmarkResults.cpuScore}
            gpuScore={nodeInfo.latestBenchmarkResults.gpuScore}
            bandwidthScore={nodeInfo.latestBenchmarkResults.bandwidthScore}
            totalScore={nodeInfo.latestBenchmarkResults.totalScore}
          />
        ) : null}
      </div>

      <div className={styles.envInfo}>
        <div className={styles.envResources}>
          {hasGpus && <div className={styles.gpuTypes}>{renderGpuTypes()}</div>}
          {computeText && <div className={styles.compute}>{computeText}</div>}
          {vramWarning && (
            <div className={styles.compute} role="status">
              {vramWarning}
            </div>
          )}
          {onSelect && durationRangeText && (
            <div className={styles.duration}>Service duration: {durationRangeText}</div>
          )}
        </div>

        <div className="actionsGroupMdEnd">
          {!tokenForced && Object.entries(supportedTokensSymbols).length > 1 ? (
            <Select
              onChange={(e) => setTokenAddress(e.target.value)}
              options={Object.entries(supportedTokensSymbols).map(([address, symbol]) => ({
                value: address,
                label: symbol ?? address,
              }))}
              size="sm"
              value={tokenAddress}
            />
          ) : null}
          {onSelect ? (
            <Tooltip title={selectBlockedReason ?? ''}>
              {/* Disabled button swallows focus/pointer events — focusable, labelled wrapper keeps the
                  blocked reason reachable by keyboard and screen readers. */}
              <span
                className="flexColumn"
                tabIndex={selectBlockedReason ? 0 : undefined}
                aria-label={selectBlockedReason ?? undefined}
              >
                <Button
                  className={styles.continueButton}
                  color="accent1"
                  contentBefore={<PlayArrowIcon />}
                  disabled={selectDisabled || committing}
                  onClick={handleContinue}
                  type="button"
                  variant="filled"
                >
                  {formatTokenAmount(price, tokenAddress)} {tokenSymbol}
                </Button>
              </span>
            </Tooltip>
          ) : hidePrice ? null : (
            <span className={styles.price}>
              {formatTokenAmount(price, tokenAddress)} {tokenSymbol}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

export default InferenceEnvironmentCard;
