import BenchmarkSummary from '@/components/benchmarks/benchmark-summary';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import useInferenceAllocation, {
  drawUnitsAcrossTypes,
  GpuSelection,
  ResourceSizing,
} from '@/components/hooks/use-inference-allocation';
import useLiveEnv from '@/components/hooks/use-live-env';
import Select from '@/components/input/select';
import { getSupportedTokens } from '@/constants/tokens';
import { useTokensSymbols, useTokenSymbol } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { assertAllocationAvailable, buildGpuRequests, gpuSelectionMessage } from '@/services/inference-launch';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { checkEnvAccess } from '@/utils/check-env-access';
import { DeclaredRequirement, declaredGpuOptions, preferredGpuOption } from '@/utils/env-resources';
import { getEnvSupportedTokens } from '@/utils/env-tokens';
import { formatDuration, formatTokenAmount } from '@/utils/formatters';
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
    environment: ComputeEnvironment
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
  /** Seeds the chips when the card is uncontrolled (e.g. restoring a prior pick for this env). Defaults to all units. */
  initialSelection?: GpuSelection;
  /**
   * How to size/display/price the shared CPU/RAM/disk: `pinned` fixed amounts (quick start), a `floor`
   * under the GPU-fraction slice (advanced handoff), or the `exact` amounts a running service booked
   * (manage page). Omit for the proportional slice. See {@link ResourceSizing}.
   */
  sizing?: ResourceSizing;
  /**
   * The launch target's declared resource requirements (template `requiredResources`/
   * `recommendedResources`, or a package's `requiredResources`) — used ONLY to restrict which GPU unit
   * counts are offered per type (see {@link declaredGpuOptions}). Omit (or pass a requirement list with
   * no GPU entry) to keep the full 1..max row, e.g. the custom HF-model flow which declares nothing.
   */
  declaredRequirements?: DeclaredRequirement[];
  /**
   * Whether a 0-unit pick is offerable at all on this card. Defaults to false, preserving today's
   * behavior exactly ("select at least one GPU unit to continue"). Even when true, zero only actually
   * appears on a type's row the env itself lets you book none of (`MergedGpu.allowsZero`) — an env whose
   * GPU resources require at least one unit keeps blocking zero regardless of this flag. Set true only for the template flows (details modal + Advanced env picker
   * in Template mode); custom-model, default-model, and quick-start-package flows must keep the
   * existing hard floor of 1, so this stays false there.
   */
  allowZeroGpu?: boolean;
};

function formatGb(value: number): string {
  const rounded = Math.round(value);
  if (rounded >= 1000 && rounded % 1000 === 0) {
    return `${rounded / 1000} TB`;
  }
  return `${rounded} GB`;
}

const InferenceEnvironmentCard: React.FC<InferenceEnvironmentCardProps> = ({
  environment: listedEnvironment,
  nodeInfo,
  durationSeconds,
  defaultToken,
  selected = false,
  onSelect,
  onTokenChange,
  disabledReason,
  gpuSelection: controlledSelection,
  initialSelection,
  sizing,
  declaredRequirements,
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
  // Local per-type selection when the card owns it; null until we learn the GPU types.
  const [ownSelection, setOwnSelection] = useState<GpuSelection | null>(null);

  const activeSelection = isControlled ? controlledSelection : (ownSelection ?? undefined);

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
    gpuSelection: activeSelection,
    sizing,
    durationSeconds,
  });

  // Declared GPU requirement (template/package), if any — restricts each type's row to just the
  // declared values instead of the full 1..max range, and drives the default (biggest declared option,
  // clamped) below instead of "every pickable unit". `undefined` (no requirement passed, or one with no
  // GPU entry — e.g. the custom HF-model flow) makes declaredGpuOptions return null per type, which is
  // the "no restriction" signal that keeps today's full-range behavior end to end.
  const gpuReq = declaredRequirements?.find((r) => r.type === 'gpu');

  // Per-type zero-eligibility: `allowZeroGpu` is caller policy (template flows only), but zero is only
  // ever actually offered on a TYPE the env itself lets you book none of (`MergedGpu.allowsZero` — see
  // that field's docblock). An env requiring >= 1 unit of a type keeps blocking zero on that row even
  // when the caller allows it in general.
  const zeroAllowedFor = useCallback((gpu: { allowsZero: boolean }) => allowZeroGpu && gpu.allowsZero, [allowZeroGpu]);

  // Seed the local chips once the types are known: restore a prior pick for this env, else default to
  // the biggest declared+clamped option (or, with nothing declared, every pickable unit — today's
  // behavior). Same budget-draw as the hook's selectedByKey (drawUnitsAcrossTypes) so the seed never
  // sums past what CPU/RAM/disk can back. A restored pick is clamped to the per-type budget left
  // (`cap`), matching the disable rules the chips render.
  useEffect(() => {
    if (!isControlled && ownSelection === null && mergedGpus.length > 0) {
      setOwnSelection(
        drawUnitsAcrossTypes(mergedGpus, maxByKey, maxUnitsByResources, (g, cap) => {
          const prior = initialSelection?.[g.key];
          if (prior !== undefined) {
            // A restored pick is clamped to `cap` (it can exceed current availability).
            return Math.min(Math.max(prior, 0), cap);
          }
          // No prior pick: default to the declared requirement's biggest option (clamped to this type's
          // physical max, the same ceiling declaredGpuOptions uses for the row itself) rather than `cap`
          // — a template asking for "1" must not default to booking every free unit. Then still clamp to
          // `cap` so the default can't exceed the shared budget either.
          //
          // A target declaring NO GPU requirement (jupyterlab, hermes) takes the row's MINIMUM instead:
          // it can't use a GPU, so the top of the offered range would book and price every free unit.
          // That minimum is 0 where zero is permitted, else the 1-unit floor. Only when the row itself
          // is unrestricted (nothing declared AND zero not allowed) does this return undefined and let
          // drawUnitsAcrossTypes fill `cap` — the original behavior for the custom-model flow.
          const options = declaredGpuOptions(gpuReq, g.max, { allowZero: zeroAllowedFor(g) });
          const preferred = gpuReq ? preferredGpuOption(options) : options?.[0];
          return preferred === undefined ? undefined : Math.min(preferred, cap);
        })
      );
    }
  }, [isControlled, ownSelection, mergedGpus, maxByKey, maxUnitsByResources, initialSelection, gpuReq, zeroAllowedFor]);

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

  const setTypeCount = (key: string, count: number) => {
    setOwnSelection((prev) => ({ ...(prev ?? {}), [key]: count }));
    // The user is committing to a count — make sure the units behind it are really free. Rate-limited
    // and coalesced inside the hook, so a 1x → 2x → 4x burst costs one read.
    void refreshLiveEnv();
  };

  // A live read can shrink what's bookable — another tenant took GPU units of a type (maxByKey), or
  // took shared CPU/RAM/disk so fewer units can be backed at all (maxUnitsByResources). Trim the chips
  // to both, or Continue would carry a count the node can no longer satisfy: `selectedByKey`
  // deliberately clamps an explicit pick to the PHYSICAL max, not to availability, so nothing else does.
  //
  // Runs through the same `drawUnitsAcrossTypes` the seed above uses, so a trimmed pick lands exactly
  // where a fresh seed would — per-type ceiling first, combined budget drawn down in declared order.
  // Neither ceiling depends on the selection, so this can't feed back into itself.
  useEffect(() => {
    setOwnSelection((prev) => {
      if (!prev || mergedGpus.length === 0) {
        return prev;
      }
      const next = drawUnitsAcrossTypes(mergedGpus, maxByKey, maxUnitsByResources, (g, cap) => {
        const clamped = Math.min(Math.max(prev[g.key] ?? 0, 0), cap);
        // With a declared requirement, a trim must still land on one of the row's OFFERED options, or
        // Continue would carry a count with no corresponding button (confusing — "selected" with
        // nothing highlighted). Snap down to the largest offered option that still fits `clamped`;
        // options are clamped to `g.max` (not `cap`), so this can legitimately fall through to 0 when
        // even the smallest declared option no longer fits the shrunk budget — same as the undeclared
        // case clamping to 0, just via a different route.
        const options = declaredGpuOptions(gpuReq, g.max, { allowZero: zeroAllowedFor(g) });
        if (!options) {
          return clamped;
        }
        const fitting = options.filter((n) => n <= clamped);
        return fitting.length > 0 ? fitting[fitting.length - 1] : 0;
      });
      // Identity matters: returning a fresh object every render would re-render forever.
      const unchanged = mergedGpus.every((g) => next[g.key] === prev[g.key]);
      return unchanged ? prev : next;
    });
  }, [mergedGpus, maxByKey, maxUnitsByResources, gpuReq, zeroAllowedFor]);

  const computeText = [
    allocation.cpu > 0 && `${allocation.cpu} CPU`,
    allocation.ram > 0 && `${formatGb(allocation.ram)} RAM`,
    allocation.disk > 0 && `${formatGb(allocation.disk)} disk`,
  ]
    .filter(Boolean)
    .join(' · ');

  const renderGpuTypes = () => {
    if (!hasGpus) {
      return null;
    }
    // For each type, the shared CPU/RAM/disk budget left after units committed to OTHER types. Keeps
    // the COMBINED pick within maxUnitsByResources without reserving budget per type up front (which
    // would wrongly starve later types).
    return mergedGpus.map((gpu) => {
      const chosen = selectedByKey[gpu.key] ?? 0;
      const othersSelected = selectedTotal - chosen;
      const budgetForThisType = Math.max(0, maxUnitsByResources - othersSelected);
      // Pickable = this type's own free units, capped by the shared budget left after other types.
      const pickable = Math.min(maxByKey[gpu.key] ?? 0, budgetForThisType);
      // Options to offer as buttons: the declared min/recommended, clamped into [1, gpu.max] (or
      // [0, gpu.max] on a zero-permitting type) and deduped — or, with nothing declared, every unit
      // 1..gpu.max (today's behavior, unchanged; declaredGpuOptions itself widens this to include 0
      // when zero is allowed and nothing was declared — see its docblock). Note this clamps against the
      // type's PHYSICAL max, not `pickable` — an option above `pickable` still renders, just disabled
      // with its existing tooltip reason, per spec (nothing is ever removed for being currently
      // unavailable, only for not being a declared/useful value).
      const zeroAllowed = zeroAllowedFor(gpu);
      const options =
        declaredGpuOptions(gpuReq, gpu.max, { allowZero: zeroAllowed }) ??
        Array.from({ length: gpu.max }, (_, i) => i + 1);
      return (
        <div className={styles.gpuType} key={gpu.key}>
          <HardwareLabel className={styles.gpuLabel} type="gpu" value={gpu.description || 'GPU'} />
          {editable ? (
            <div className={styles.counts}>
              {/* All offered units shown; counts above what's free are disabled (in use, or not enough
                  shared CPU/RAM/disk) with a tooltip explaining why. */}
              {options.map((n) => {
                const disabled = n > pickable;
                const button = (
                  <Button
                    color="accent1"
                    disabled={disabled}
                    onClick={() => setTypeCount(gpu.key, n)}
                    size="xs"
                    variant={chosen === n ? 'filled' : 'outlined'}
                  >
                    {n}x
                  </Button>
                );
                const disabledReason =
                  n > gpu.available
                    ? 'This many units are currently in use.'
                    : 'Not enough shared CPU/ RAM/ disk to back this many units right now.';
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
            </div>
          ) : (
            <span className={classNames('chip', 'chipAccent2', styles.countStatic)}>
              {chosen} / {gpu.max} selected
            </span>
          )}
        </div>
      );
    });
  };

  // Reason the env can't be selected right now: a caller-supplied block (e.g. duration out of bounds)
  // wins, then the wallet/access gate — the node enforces the env's access list at serviceStart (403
  // 'Access denied'), so block here rather than after the user has paid escrow — then GPU-only cases
  // — fully busy, or the user zeroed every type — then a cross-resource constraint the built request
  // would violate (the node would reject it). Null → selectable. Drives the disabled state + tooltip.
  const accessBlockedReason =
    paidAccess === null
      ? 'You need to log in to continue.'
      : paidAccess
        ? null
        : "Your wallet address is not in this environment's access list.";
  // Zero is a legitimate "continue" state only when EVERY GPU type in the env allows it — a mixed env
  // (one type with min 0, another with min 1) still needs at least one real unit picked overall, since
  // the type requiring >= 1 is never satisfied by leaving it at zero.
  const zeroSelectionAllowed = hasGpus && mergedGpus.every((g) => zeroAllowedFor(g));
  // A user who deliberately wants 0 GPUs doesn't care that every unit is currently busy — exhaustion
  // only matters to a selection that actually asks for units. Without this, a zero-permitting template
  // on a fully-booked env would wrongly show "all GPU units in use" for a pick that needs none.
  const zeroSelected = selectedTotal <= 0 && zeroSelectionAllowed;
  const selectBlockedReason =
    disabledReason ??
    accessBlockedReason ??
    (hasGpus
      ? gpuExhausted && !zeroSelected
        ? 'All GPU units in this environment are currently in use.'
        : selectedTotal <= 0 && !zeroSelectionAllowed
          ? 'Select at least one GPU unit to continue.'
          : (constraintViolation ?? null)
      : (constraintViolation ?? null));
  const selectDisabled = !tokenSymbol || !!selectBlockedReason;

  /**
   * Commit the pick against a freshly-read environment. The node is the only authority on which units
   * are free, and it rejects a serviceStart naming a taken GPU outright — so re-read first, and when
   * the pick no longer fits, say so and let the (now trimmed) chips be re-picked instead of carrying a
   * doomed selection into the payment step.
   */
  // The live read Continue forces is a node round trip, and the button stays mounted across it — a
  // second click would start a second dial and could commit the pick (and navigate) twice.
  const [committing, setCommitting] = useState(false);
  const handleContinue = async () => {
    if (selectDisabled || committing || !tokenSymbol || !onSelect) {
      return;
    }
    setCommitting(true);
    try {
      const read = await refreshLiveEnv(true);
      const fresh = read.env ?? environment;
      // Validate against the node's own numbers, and only those. When the read fell back to the backend
      // snapshot (`live: false` — node unreachable, P2P not up, env not in its list) the checks below
      // would be measuring the snapshot against itself: guaranteed to pass, and then the launch fails
      // at serviceStart. Say the availability is unverified instead of pretending it was checked.
      //
      // Stopping here strands nobody who could otherwise have launched: the launch is itself a P2P
      // call (serviceStart), and the payment step already blocks Next while the node is unreachable.
      // So this only moves the same failure earlier — to before the escrow deposit, rather than after.
      if (!read.live) {
        toast.error(
          read.reason === 'unidentified'
            ? 'This node is no longer offering the environment you picked. Go back and choose one again.'
            : "Couldn't reach the node to confirm these GPUs are still free. Check your connection and try again."
        );
        return;
      }
      const freshResources = fresh.resources ?? [];
      try {
        buildGpuRequests(freshResources, selectedByKey);
        // The shared resources too, not just the GPU units. `allocation` is the CPU/RAM/disk this pick
        // is priced on, and nothing checked it until the launch itself (inference-launch) — so a tenant
        // taking CPU or RAM in between carried a doomed selection all the way to the payment step. Uses
        // the same assertion the launch does, so selection and launch can't disagree on what fits.
        assertAllocationAvailable(freshResources, allocation);
      } catch (error) {
        toast.error(
          gpuSelectionMessage(error, 'in the meantime') ??
            'This environment can no longer host that selection. Adjust it and try again.'
        );
        return;
      }
      onSelect(tokenAddress, tokenSymbol, selectedByKey, fresh);
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
        </div>

        <div className="actionsGroupMdEnd">
          {onSelect && durationRangeText && <span className="textSecondary">Job duration: {durationRangeText}</span>}
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
          ) : (
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
