import BenchmarkSummary from '@/components/benchmarks/benchmark-summary';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import useInferenceAllocation, { GpuSelection } from '@/components/hooks/use-inference-allocation';
import Select from '@/components/input/select';
import { getSupportedTokens } from '@/constants/tokens';
import { useTokensSymbols, useTokenSymbol } from '@/lib/token-symbol';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { getEnvSupportedTokens } from '@/utils/env-tokens';
import { formatDuration, formatTokenAmount } from '@/utils/formatters';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VerifiedIcon from '@mui/icons-material/Verified';
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
  /**
   * Units per GPU type to use. Uncontrolled when omitted (card owns its selection via the chips);
   * pass a value to render a fixed selection read-only (e.g. the selection summary).
   */
  gpuSelection?: GpuSelection;
  /** Seeds the chips when the card is uncontrolled (e.g. restoring a prior pick for this env). Defaults to all units. */
  initialSelection?: GpuSelection;
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
  gpuSelection: controlledSelection,
  initialSelection,
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

  const isControlled = controlledSelection !== undefined;
  // Local per-type selection when the card owns it; null until we learn the GPU types.
  const [ownSelection, setOwnSelection] = useState<GpuSelection | null>(null);

  const activeSelection = isControlled ? controlledSelection : (ownSelection ?? undefined);

  const { mergedGpus, selectedByKey, allocation, price, hasGpus } = useInferenceAllocation({
    environment,
    tokenAddress,
    gpuSelection: activeSelection,
    durationSeconds,
  });

  // Seed the local chips once the types are known: restore a prior pick for this env, or default to all units.
  useEffect(() => {
    if (!isControlled && ownSelection === null && mergedGpus.length > 0) {
      const seeded: GpuSelection = {};
      mergedGpus.forEach((g) => {
        const prior = initialSelection?.[g.key];
        seeded[g.key] = prior === undefined ? g.max : Math.min(Math.max(prior, 0), g.max);
      });
      setOwnSelection(seeded);
    }
  }, [isControlled, ownSelection, mergedGpus, initialSelection]);

  const editable = !isControlled && !!onSelect;

  // Paid service-on-demand job-duration window (inference always uses a paid token → top-level
  // bounds, not `free.*`). Shown next to the select button so the user knows the valid range.
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
    allocation.ram > 0 && formatGb(allocation.ram),
    allocation.disk > 0 && formatGb(allocation.disk),
  ]
    .filter(Boolean)
    .join(' · ');

  const renderGpuTypes = () => {
    if (!hasGpus) {
      return null;
    }
    return mergedGpus.map((gpu) => {
      const chosen = selectedByKey[gpu.key] ?? 0;
      return (
        <>
          <div className={styles.gpuType} key={gpu.key}>
            <HardwareLabel className={styles.gpuLabel} type="gpu" value={gpu.description || 'GPU'} />-
            {editable ? (
              <div className={styles.counts}>
                {Array.from({ length: gpu.max }, (_, i) => i + 1).map((n) => (
                  <Button
                    color="accent1"
                    key={n}
                    onClick={() => setTypeCount(gpu.key, n)}
                    size="xs"
                    variant={chosen === n ? 'filled' : 'outlined'}
                  >
                    {n}x
                  </Button>
                ))}
              </div>
            ) : (
              <span className={classNames('chip', 'chipAccent2', styles.countStatic)}>
                {chosen} / {gpu.max} selected
              </span>
            )}
          </div>
        </>
      );
    });
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
            {nodeInfo.latestBenchmarkResults ? <VerifiedIcon className={styles.verified} /> : null}
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
            <Button
              className={styles.continueButton}
              color="accent1"
              contentBefore={<PlayArrowIcon />}
              disabled={!tokenSymbol}
              onClick={() => tokenSymbol && onSelect(tokenAddress, tokenSymbol, selectedByKey)}
              type="button"
              variant="filled"
            >
              {formatTokenAmount(price, tokenAddress)} {tokenSymbol}
            </Button>
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
