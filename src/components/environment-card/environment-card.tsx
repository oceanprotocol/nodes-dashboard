import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Checkbox from '@/components/checkbox/checkbox';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import Select from '@/components/input/select';
import ProgressBar from '@/components/progress-bar/progress-bar';
import { getSupportedTokens } from '@/constants/tokens';
import { useRunJobContext } from '@/context/run-job-context';
import { useTokensSymbols, useTokenSymbol } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { checkEnvAccess } from '@/utils/check-env-access';
import { getEnvSupportedTokens } from '@/utils/env-tokens';
import { formatNumber } from '@/utils/formatters';
import DnsIcon from '@mui/icons-material/Dns';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MemoryIcon from '@mui/icons-material/Memory';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import { Collapse, Tooltip } from '@mui/material';
import classNames from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useEffect, useMemo, useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import styles from './environment-card.module.css';

type EnvironmentCardProps = {
  compact?: boolean;
  defaultToken?: string;
  environment: ComputeEnvironment;
  nodeInfo: EnvNodeInfo;
  showNodeName?: boolean;
};

const EnvironmentCard: React.FC<EnvironmentCardProps> = ({
  compact,
  defaultToken,
  environment,
  nodeInfo,
  showNodeName,
}) => {
  const router = useRouter();

  const { selectEnv, selectToken } = useRunJobContext();
  const { account, provider } = useOceanAccount();

  const [paidAccess, setPaidAccess] = useState<boolean | null>(null);
  const [freeAccess, setFreeAccess] = useState<boolean | null>(null);

  useEffect(() => {
    checkEnvAccess(environment.access, account.address, provider).then(setPaidAccess);
  }, [environment.access, account.address, provider]);

  useEffect(() => {
    checkEnvAccess(environment.free?.access, account.address, provider).then(setFreeAccess);
  }, [environment.free?.access, account.address, provider]);

  const supportedTokens = useMemo(() => {
    return getEnvSupportedTokens(environment, true);
  }, [environment]);

  const supportedTokensSymbols = useTokensSymbols(supportedTokens);

  const getDefaultToken = () => {
    if (defaultToken && supportedTokens.includes(defaultToken)) {
      return defaultToken;
    }
    if (supportedTokens.some((t) => t.toLowerCase() === getSupportedTokens().USDC.toLowerCase())) {
      return getSupportedTokens().USDC;
    }
    return supportedTokens[0];
  };

  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>(getDefaultToken());
  const selectedTokenSymbol = useTokenSymbol(selectedTokenAddress);

  const [isFreeCompute, setIsFreeCompute] = useState<boolean>(false);

  const { cpu, cpuFee, disk, diskFee, gpus, gpuFees, ram, ramFee } = useEnvResources({
    environment,
    freeCompute: isFreeCompute,
    tokenAddress: selectedTokenAddress,
  });
  const noResourcesAvailable = !cpu && !gpus?.length && !ram && !disk;

  const startingFee = useMemo(() => {
    const minGpuFee = Object.values(gpuFees).reduce((min, fee) => (fee < min ? fee : min), Infinity);
    return (cpuFee ?? 0) + (ramFee ?? 0) + (diskFee ?? 0) + (minGpuFee === Infinity ? 0 : minGpuFee);
  }, [cpuFee, diskFee, gpuFees, ramFee]);

  const minJobDurationHours = (environment.minJobDuration ?? 0) / 60 / 60;
  const maxJobDurationHours = (environment.maxJobDuration ?? 0) / 60 / 60;

  const selectEnvironment = () => {
    selectEnv({
      environment,
      freeCompute: false,
      nodeInfo,
    });
    selectToken(selectedTokenAddress, selectedTokenSymbol);
    posthog.capture('environment_selected', {
      environmentId: environment.id,
      nodeId: nodeInfo.id,
      freeCompute: false,
    });
    router.push('/run-job/resources');
  };

  const selectFreeCompute = () => {
    selectEnv({
      environment,
      freeCompute: true,
      nodeInfo,
    });
    selectToken(selectedTokenAddress, selectedTokenSymbol);
    posthog.capture('environment_selected', {
      environmentId: environment.id,
      nodeId: nodeInfo.id,
      freeCompute: true,
    });
    router.push('/run-job/resources');
  };

  const getCpuProgressBar = () => {
    if (!cpu) {
      return null;
    }
    const max = cpu.max ?? 0;
    const inUse = cpu.inUse ?? 0;
    const available = max - inUse;
    const fee = cpuFee ?? 0;
    if (compact) {
      return (
        <div className={styles.cpuWrapper}>
          <div className={styles.label}>
            <MemoryIcon className={styles.icon} />
            <span className={styles.heading}>{cpu?.description}</span>
          </div>
          <div className={styles.label}>
            <span className={styles.em}>
              {available} / {max}
            </span>
            &nbsp;cores available
          </div>
          <TransitionGroup>
            {isFreeCompute ? null : (
              <Collapse>
                <div className={styles.label}>
                  <span className={styles.em}>{fee}</span>&nbsp;{selectedTokenSymbol} / core / min
                </div>
              </Collapse>
            )}
          </TransitionGroup>
        </div>
      );
    }
    const percentage = (100 * inUse) / max;
    return (
      <div className={styles.cpuWrapper}>
        <ProgressBar
          value={percentage}
          topLeftContent={
            <span className={classNames(styles.label, styles.em)}>
              <MemoryIcon className={styles.icon} /> CPU - {cpu?.description}
            </span>
          }
          bottomLeftContent={
            <span className={styles.label}>
              <span className={styles.em}>
                {available} / {max}
              </span>
              &nbsp;cores available
            </span>
          }
          bottomRightContent={
            <span className={styles.label}>
              <span className={styles.em}>{fee}</span>&nbsp;{selectedTokenSymbol} / core / min
            </span>
          }
        />
      </div>
    );
  };

  const getGpuProgressBars = () => {
    const mergedGpus = gpus.reduce(
      (merged, gpuToCheck) => {
        const existingGpu = merged.find(
          (gpu) => gpu.description === gpuToCheck.description && gpuFees[gpu.id] === gpuFees[gpuToCheck.id]
        );
        if (existingGpu) {
          existingGpu.inUse = (existingGpu.inUse ?? 0) + (gpuToCheck.inUse ?? 0);
          existingGpu.max += gpuToCheck.max;
        } else {
          merged.push({ ...gpuToCheck });
        }
        return merged;
      },
      [] as typeof gpus
    );
    return mergedGpus.map((gpu) => {
      const max = gpu.max ?? 0;
      const inUse = gpu.inUse ?? 0;
      const available = max - inUse;
      const fee = gpuFees[gpu.id] ?? 0;
      if (compact) {
        return (
          <div className={styles.gpuWrapper} key={gpu.id}>
            <GpuLabel className={classNames(styles.heading, styles.label)} gpu={gpu.description} />
            <div className={styles.label}>
              <span className={styles.em}>
                {available} / {max}
              </span>
              &nbsp;units available
            </div>
            <TransitionGroup>
              {isFreeCompute ? null : (
                <Collapse>
                  <div className={styles.label}>
                    <span className={styles.em}>{fee}</span>&nbsp;{selectedTokenSymbol} / unit / min
                  </div>
                </Collapse>
              )}
            </TransitionGroup>
          </div>
        );
      }
      const percentage = (100 * inUse) / max;
      return (
        <div className={styles.gpuWrapper} key={gpu.id}>
          <ProgressBar
            value={percentage}
            topLeftContent={<GpuLabel className={classNames(styles.heading, styles.label)} gpu={gpu.description} />}
            bottomLeftContent={
              <span className={styles.label}>
                <span className={styles.em}>
                  {available} / {max}
                </span>
                &nbsp;units available
              </span>
            }
            bottomRightContent={
              <span className={styles.label}>
                <span className={styles.em}>{fee}</span>&nbsp;{selectedTokenSymbol} / unit / min
              </span>
            }
          />
        </div>
      );
    });
  };

  const getRamProgressBar = () => {
    if (!ram) {
      return null;
    }
    const max = ram.max ?? 0;
    const inUse = ram.inUse ?? 0;
    const available = max - inUse;
    const fee = ramFee ?? 0;
    if (compact) {
      return (
        <div className={styles.ramWrapper}>
          <div className={styles.label}>
            <SdStorageIcon className={styles.icon} />
            <span className={styles.heading}>RAM capacity</span>
          </div>
          <div className={styles.label}>
            <span className={styles.em}>
              {available} / {max}
            </span>
            &nbsp;GB available
          </div>
          <TransitionGroup>
            {isFreeCompute ? null : (
              <Collapse>
                <div className={styles.label}>
                  <span className={styles.em}>{fee}</span>&nbsp;{selectedTokenSymbol} / GB / min
                </div>
              </Collapse>
            )}
          </TransitionGroup>
        </div>
      );
    }
    const percentage = (100 * inUse) / max;
    return (
      <div className={styles.ramWrapper}>
        <ProgressBar
          value={percentage}
          topLeftContent={
            <span className={classNames(styles.label, styles.em)}>
              <SdStorageIcon className={styles.icon} /> RAM capacity
            </span>
          }
          bottomLeftContent={
            <span className={styles.label}>
              <span className={styles.em}>
                {available} / {max}
              </span>
              &nbsp;GB available
            </span>
          }
          bottomRightContent={
            <span className={styles.label}>
              <span className={styles.em}>{fee}</span>&nbsp;{selectedTokenSymbol} / GB / min
            </span>
          }
        />
      </div>
    );
  };

  const getDiskProgressBar = () => {
    if (!disk) {
      return null;
    }
    const max = disk.max ?? 0;
    const inUse = disk.inUse ?? 0;
    const available = max - inUse;
    const fee = diskFee ?? 0;
    if (compact) {
      return (
        <div className={styles.diskWrapper}>
          <div className={styles.label}>
            <DnsIcon className={styles.icon} />
            <span className={styles.heading}>Disk space</span>
          </div>
          <div className={styles.label}>
            <span className={styles.em}>
              {available} / {max}
            </span>
            &nbsp;GB available
          </div>
          <TransitionGroup>
            {isFreeCompute ? null : (
              <Collapse>
                <div className={styles.label}>
                  <span className={styles.em}>{fee}</span>&nbsp;{selectedTokenSymbol} / GB / min
                </div>
              </Collapse>
            )}
          </TransitionGroup>
        </div>
      );
    }
    const percentage = (100 * inUse) / max;
    return (
      <div className={styles.diskWrapper}>
        <ProgressBar
          value={percentage}
          topLeftContent={
            <span className={classNames(styles.label, styles.em)}>
              <DnsIcon className={styles.icon} /> Disk space
            </span>
          }
          bottomLeftContent={
            <span className={styles.label}>
              <span className={styles.em}>
                {available} / {max}
              </span>
              &nbsp;GB available
            </span>
          }
          bottomRightContent={
            <span className={styles.label}>
              <span className={styles.em}>{fee}</span>&nbsp;{selectedTokenSymbol} / GB / min
            </span>
          }
        />
      </div>
    );
  };

  const getFreeComputeCheckbox = () => {
    if (!environment.free) {
      return null;
    }
    const isLoggedIn = freeAccess !== null;
    const isDisabled = !isLoggedIn || !freeAccess;
    const label = 'Free compute';
    return (
      <Checkbox
        className={styles.freeComputeCheckbox}
        disabled={isDisabled}
        label={
          isDisabled ? (
            <div className="flexRow alignItemsCenter gapSm">
              {label}
              <Tooltip
                title={
                  isLoggedIn
                    ? "Your wallet address is not in this environment's access list"
                    : 'You need to log in to continue'
                }
              >
                <InfoOutlinedIcon className={styles.accessInfoIcon} />
              </Tooltip>
            </div>
          ) : (
            label
          )
        }
        checked={isFreeCompute}
        onChange={() => setIsFreeCompute(!isFreeCompute)}
        type="multiple"
      />
    );
  };

  const getRunJobButton = () => {
    const isLoggedIn = freeAccess !== null && paidAccess !== null;
    const isDisabled = !isLoggedIn || (isFreeCompute && !freeAccess) || (!isFreeCompute && !paidAccess);
    const button = (
      <Button
        color="accent1"
        contentBefore={<PlayArrowIcon />}
        disabled={isDisabled}
        onClick={isFreeCompute ? selectFreeCompute : selectEnvironment}
      >
        {isFreeCompute ? 'Try for free' : `From ${startingFee} ${selectedTokenSymbol}/min`}
      </Button>
    );
    if (isDisabled) {
      return (
        <Tooltip
          title={
            isLoggedIn
              ? isFreeCompute
                ? "Your wallet address is not in this environment's free compute access list"
                : "Your wallet address is not in this environment's paid compute access list"
              : 'You need to login to continue'
          }
        >
          <div>{button}</div>
        </Tooltip>
      );
    }
    return button;
  };

  return (
    <Card
      className={styles.root}
      direction="column"
      innerShadow="black"
      padding="sm"
      radius="md"
      spacing="lg"
      variant="glass"
    >
      <div>
        <TransitionGroup>
          {!noResourcesAvailable ? (
            <Collapse>
              <div className={styles.gridWrapper}>
                {compact ? (
                  <div className={classNames(styles.compactGrid)}>
                    {getGpuProgressBars()}
                    {getCpuProgressBar()}
                    {getRamProgressBar()}
                    {getDiskProgressBar()}
                  </div>
                ) : gpus.length === 1 ? (
                  <>
                    <h4>Specs</h4>
                    <div className={classNames(styles.grid)}>
                      {getGpuProgressBars()}
                      {getCpuProgressBar()}
                      {getRamProgressBar()}
                      {getDiskProgressBar()}
                    </div>
                  </>
                ) : (
                  <>
                    <h4>GPUs</h4>
                    <div className={classNames(styles.grid, styles.gpuSpecs)}>{getGpuProgressBars()}</div>
                    <h4>Other specs</h4>
                    <div className={classNames(styles.grid, styles.specsWithoutGpus)}>
                      {getCpuProgressBar()}
                      {getRamProgressBar()}
                      {getDiskProgressBar()}
                    </div>
                  </>
                )}
              </div>
            </Collapse>
          ) : null}
        </TransitionGroup>
        <TransitionGroup>
          {noResourcesAvailable ? (
            <Collapse>
              <h3>No resources available</h3>
            </Collapse>
          ) : null}
        </TransitionGroup>
      </div>

      <div className={styles.footer}>
        <div>
          {showNodeName ? (
            <div>
              Node:{' '}
              <Link className={styles.link} href={`/nodes/${nodeInfo.id}`} target="_blank">
                {nodeInfo.friendlyName ?? nodeInfo.id}
              </Link>
            </div>
          ) : null}
          <div>
            Job duration:&nbsp;
            <strong>
              {formatNumber(minJobDurationHours)} - {formatNumber(maxJobDurationHours)}
            </strong>
            &nbsp;hours
          </div>
          {getFreeComputeCheckbox()}
        </div>
        <div className={styles.buttons}>
          {Object.entries(supportedTokensSymbols).length > 1 && !isFreeCompute ? (
            <Select
              onChange={(e) => setSelectedTokenAddress(e.target.value)}
              options={Object.entries(supportedTokensSymbols).map(([address, symbol]) => ({
                value: address,
                label: symbol ?? address,
              }))}
              size="sm"
              value={selectedTokenAddress}
            />
          ) : null}
          {getRunJobButton()}
        </div>
      </div>
    </Card>
  );
};

export default EnvironmentCard;
