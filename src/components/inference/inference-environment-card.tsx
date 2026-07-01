import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
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
  onSelect?: (tokenAddress: string, tokenSymbol: string) => void;
};

function formatGb(value: number): string {
  if (value >= 1000 && value % 1000 === 0) {
    return `${value / 1000} TB`;
  }
  return `${value} GB`;
}

const InferenceEnvironmentCard: React.FC<InferenceEnvironmentCardProps> = ({
  environment,
  nodeInfo,
  durationSeconds,
  defaultToken,
  selected = false,
  onSelect,
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
  const tokenSymbol = useTokenSymbol(tokenAddress);

  useEffect(() => {
    setTokenAddress(getDefaultToken());
  }, [getDefaultToken]);

  const { cpu, cpuFee, disk, diskFee, gpus, gpuFees, ram, ramFee } = useEnvResources({
    environment,
    freeCompute: false,
    tokenAddress,
  });

  const totalPrice = useMemo(() => {
    const cpuTotal = (cpuFee ?? 0) * (cpu?.max ?? 0);
    const ramTotal = (ramFee ?? 0) * (ram?.max ?? 0);
    const diskTotal = (diskFee ?? 0) * (disk?.max ?? 0);
    const gpuTotal = gpus.reduce((sum, gpu) => sum + (gpuFees[gpu.id] ?? 0) * (gpu.max ?? 0), 0);
    return (cpuTotal + ramTotal + diskTotal + gpuTotal) * (durationSeconds / 60);
  }, [cpu?.max, cpuFee, disk?.max, diskFee, gpuFees, gpus, ram?.max, ramFee, durationSeconds]);

  const mergedGpus = useMemo(() => {
    return gpus.reduce(
      (merged, gpu) => {
        const existing = merged.find((g) => g.description === gpu.description);
        if (existing) {
          existing.max += gpu.max ?? 0;
        } else {
          merged.push({ description: gpu.description, max: gpu.max ?? 0 });
        }
        return merged;
      },
      [] as { description?: string; max: number }[]
    );
  }, [gpus]);

  const computeText = [cpu && `${cpu.max} vCPU`, ram && formatGb(ram.max), disk && formatGb(disk.max)]
    .filter(Boolean)
    .join(' · ');

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
        <div className={styles.specs}>
          {mergedGpus.map((gpu, index) => (
            <span className={classNames('chip', 'chipAccent2', styles.gpuChip)} key={`gpu-${index}`}>
              {gpu.max}× <GpuLabel className={styles.gpuLabel} gpu={gpu.description || 'GPU'} />
            </span>
          ))}
          {computeText && <span className={styles.compute}>{computeText}</span>}
        </div>
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
            onClick={() => onSelect(tokenAddress, tokenSymbol ?? '')}
            type="button"
            variant="filled"
          >
            {formatTokenAmount(totalPrice, tokenAddress)} {tokenSymbol}
          </Button>
        ) : (
          <span className={styles.price}>
            {formatTokenAmount(totalPrice, tokenAddress)} {tokenSymbol}
          </span>
        )}
      </div>
    </Card>
  );
};

export default InferenceEnvironmentCard;
