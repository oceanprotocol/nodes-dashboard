import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useInferenceAllocation, { GpuSelection } from '@/components/hooks/use-inference-allocation';
import Select from '@/components/input/select';
import { getSupportedTokens } from '@/constants/tokens';
import { useTokensSymbols, useTokenSymbol } from '@/lib/token-symbol';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { getEnvSupportedTokens } from '@/utils/env-tokens';
import { formatTokenAmount } from '@/utils/formatters';
import CheckIcon from '@mui/icons-material/Check';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
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

  const setTypeCount = (key: string, count: number) => {
    setOwnSelection((prev) => ({ ...(prev ?? {}), [key]: count }));
  };

  const computeText = [
    allocation.cpu > 0 && `${allocation.cpu} vCPU`,
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
        <div className={styles.gpuType} key={gpu.key}>
          <GpuLabel className={styles.gpuLabel} gpu={gpu.description || 'GPU'} />
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
                  {n}
                </Button>
              ))}
            </div>
          ) : (
            <span className={classNames('chip', 'chipAccent2', styles.countStatic)}>
              {chosen} / {gpu.max}
            </span>
          )}
        </div>
      );
    });
  };

  return (
    <Card
      className={classNames(styles.card, { [styles.selectable]: !!onSelect, [styles.selected]: selected })}
      innerShadow="black"
      padding="sm"
      radius="md"
      variant="glass-shaded"
    >
      {selected && (
        <span className={styles.check}>
          <CheckIcon fontSize="small" />
        </span>
      )}
      <div className={styles.info}>
        <div className={styles.nodeName}>
          <span className="textSecondary">Node:</span>{' '}
          <span className={styles.nodeValue}>{nodeInfo.friendlyName || nodeInfo.id}</span>
        </div>

        {hasGpus && <div className={styles.gpuTypes}>{renderGpuTypes()}</div>}

        {computeText && <div className={styles.compute}>{computeText}</div>}
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
    </Card>
  );
};

export default InferenceEnvironmentCard;
