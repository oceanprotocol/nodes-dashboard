import BenchmarkSummary from '@/components/benchmarks/benchmark-summary';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import useInferenceAllocation, {
  drawUnitsAcrossTypes,
  GpuSelection,
  ResourceSizing,
} from '@/components/hooks/use-inference-allocation';
import Select from '@/components/input/select';
import { getSupportedTokens } from '@/constants/tokens';
import { useTokensSymbols, useTokenSymbol } from '@/lib/token-symbol';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { getEnvSupportedTokens } from '@/utils/env-tokens';
import { formatDuration, formatTokenAmount } from '@/utils/formatters';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Tooltip } from '@mui/material';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './inference-environment-card.module.css';

type InferenceEnvironmentCardProps = {
  environment: ComputeEnvironment;
  nodeInfo: EnvNodeInfo;
  durationSeconds: number;
  /** Token address selected in the filters — when supported, it's forced and the token select is hidden. */
  defaultToken?: string;
  selected?: boolean;
  onSelect?: (tokenAddress: string, tokenSymbol: string, gpuSelection: GpuSelection) => void;
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
   * How to size/display/price the shared CPU/RAM/disk: `pinned` fixed amounts (quick start) or a `floor`
   * under the GPU-fraction slice (advanced handoff). Omit for the proportional slice. See {@link ResourceSizing}.
   */
  sizing?: ResourceSizing;
};

function formatGb(value: number): string {
  const rounded = Math.round(value);
  if (rounded >= 1000 && rounded % 1000 === 0) {
    return `${rounded / 1000} TB`;
  }
  return `${rounded} GB`;
}

const InferenceEnvironmentCard: React.FC<InferenceEnvironmentCardProps> = ({
  environment,
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
}) => {
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

  // Seed the local chips once the types are known: restore a prior pick for this env, or default to
  // all pickable units. Same budget-draw as the hook's selectedByKey (drawUnitsAcrossTypes) so the
  // seed never sums past what CPU/RAM/disk can back. A restored pick is clamped to the per-type
  // budget left (`cap`), matching the disable rules the chips render.
  useEffect(() => {
    if (!isControlled && ownSelection === null && mergedGpus.length > 0) {
      setOwnSelection(
        drawUnitsAcrossTypes(mergedGpus, maxByKey, maxUnitsByResources, (g, cap) => {
          const prior = initialSelection?.[g.key];
          // undefined → default this type to `cap`; a restored pick is clamped to `cap` (it can exceed
          // current availability). Returning undefined lets drawUnitsAcrossTypes fill `cap` itself.
          return prior === undefined ? undefined : Math.min(Math.max(prior, 0), cap);
        })
      );
    }
  }, [isControlled, ownSelection, mergedGpus, maxByKey, maxUnitsByResources, initialSelection]);

  const editable = !isControlled && !!onSelect;

  // Paid service-on-demand job-duration window (inference always uses a paid token → top-level bounds).
  // Shown next to the select button so the user knows the valid range.
  const durationRangeText = useMemo(() => {
    const min = environment.minJobDuration;
    const max = environment.maxJobDuration;
    if (min && max) {
      return `${formatDuration(min)} – ${formatDuration(max)}`;
    }
    if (min) {
      return `min ${formatDuration(min)}`;
    }
    if (max) {
      return `max ${formatDuration(max)}`;
    }
    return null;
  }, [environment.minJobDuration, environment.maxJobDuration]);

  const setTypeCount = (key: string, count: number) => {
    setOwnSelection((prev) => ({ ...(prev ?? {}), [key]: count }));
  };

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
      return (
        <div className={styles.gpuType} key={gpu.key}>
          <HardwareLabel className={styles.gpuLabel} type="gpu" value={gpu.description || 'GPU'} />
          {editable ? (
            <div className={styles.counts}>
              {/* All units shown; counts above what's free are disabled (in use, or not enough shared
                  CPU/RAM/disk) with a tooltip explaining why. */}
              {Array.from({ length: gpu.max }, (_, i) => i + 1).map((n) => {
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
                    <span tabIndex={0} aria-label={`${n}x — ${disabledReason}`}>
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
  // wins, then GPU-only cases — fully busy, or the user zeroed every type — then a cross-resource
  // constraint the built request would violate (the node would reject it). Null → selectable. Drives
  // the disabled state + tooltip on the select button.
  const selectBlockedReason =
    disabledReason ??
    (hasGpus
      ? gpuExhausted
        ? 'All GPU units in this environment are currently in use.'
        : selectedTotal <= 0
          ? 'Select at least one GPU unit to continue.'
          : (constraintViolation ?? null)
      : (constraintViolation ?? null));
  const selectDisabled = !tokenSymbol || !!selectBlockedReason;

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
                  disabled={selectDisabled}
                  onClick={() => !selectDisabled && tokenSymbol && onSelect(tokenAddress, tokenSymbol, selectedByKey)}
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
