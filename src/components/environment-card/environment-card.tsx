import BenchmarkSummary from '@/components/benchmarks/benchmark-summary';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Checkbox from '@/components/checkbox/checkbox';
import HardwareLabel from '@/components/hardware-label/hardware-label';
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
import { formatDuration, formatTokenAmount } from '@/utils/formatters';
import DnsIcon from '@mui/icons-material/Dns';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PublicIcon from '@mui/icons-material/Public';
import PublicOffIcon from '@mui/icons-material/PublicOff';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Collapse, Tooltip } from '@mui/material';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import styles from './environment-card.module.css';

type EnvironmentCardProps = {
  compact?: boolean;
  defaultToken?: string;
  environment: ComputeEnvironment;
  forcePricing?: 'free' | 'paid';
  nodeInfo: EnvNodeInfo;
  showNodeInfo?: boolean;
  // When provided, the card renders in "usage" mode: resource bars show the
  // amounts a past job actually consumed (matched by resource id) instead of the
  // environment's available/max, fees and the free-compute controls are hidden,
  // and the footer shows the job's real duration. Values use the same units as
  // the environment display (CPU cores, RAM/disk GB, GPU units).
  usedResources?: { id: string; amount: number }[];
  jobDurationSeconds?: number | null;
};

const EnvironmentCard: React.FC<EnvironmentCardProps> = ({
  compact,
  defaultToken,
  environment,
  forcePricing,
  nodeInfo,
  showNodeInfo,
  usedResources,
  jobDurationSeconds,
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

  useEffect(() => {
    if (forcePricing) {
      setIsFreeCompute(forcePricing === 'free');
    } else {
      setIsFreeCompute(false);
    }
  }, [forcePricing]);

  const supportedTokens = useMemo(() => {
    return getEnvSupportedTokens(environment, true);
  }, [environment]);

  const supportedTokensSymbols = useTokensSymbols(supportedTokens);

  const getDefaultToken = useCallback(() => {
    if (defaultToken && supportedTokens.includes(defaultToken)) {
      return defaultToken;
    }
    if (supportedTokens.some((t) => t.toLowerCase() === getSupportedTokens().USDC.address.toLowerCase())) {
      return getSupportedTokens().USDC.address;
    }
    return supportedTokens[0];
  }, [defaultToken, supportedTokens]);

  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>(getDefaultToken());
  const selectedTokenSymbol = useTokenSymbol(selectedTokenAddress);

  useEffect(() => {
    setSelectedTokenAddress(getDefaultToken());
  }, [getDefaultToken]);

  const [isFreeCompute, setIsFreeCompute] = useState<boolean>(
    forcePricing ? (forcePricing === 'free' ? true : false) : false
  );

  const {
    cpu,
    cpuAvailable,
    cpuFee,
    disk,
    diskAvailable,
    diskFee,
    gpus,
    gpusAvailable,
    gpuFees,
    maxJobDurationSeconds,
    minJobDurationSeconds,
    ram,
    ramAvailable,
    ramFee,
  } = useEnvResources({
    environment,
    freeCompute: isFreeCompute,
    tokenAddress: selectedTokenAddress,
  });
  const usageMode = Array.isArray(usedResources);
  const usedAmount = (id?: string | null): number | undefined =>
    usageMode && id ? usedResources!.find((r) => r.id === id)?.amount : undefined;
  const noResourcesAvailable = usageMode
    ? !(usedResources && usedResources.length > 0)
    : !cpu && !gpus?.length && !ram && !disk;

  const startingFee = useMemo(() => {
    const minGpuFee = Object.values(gpuFees).reduce((min, fee) => (fee < min ? fee : min), Infinity);
    return (cpuFee ?? 0) + (ramFee ?? 0) + (diskFee ?? 0) + (minGpuFee === Infinity ? 0 : minGpuFee);
  }, [cpuFee, diskFee, gpuFees, ramFee]);

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
    router.push({
      pathname: '/run-job/resources',
      query: {
        ...router.query,
        peerId: nodeInfo.id,
        env: environment.id,
        free: false,
        token: selectedTokenAddress,
      },
    });
  };

  const selectFreeCompute = () => {
    selectEnv({
      environment,
      freeCompute: true,
      nodeInfo,
    });
    posthog.capture('environment_selected', {
      environmentId: environment.id,
      nodeId: nodeInfo.id,
      freeCompute: true,
    });
    router.push({
      pathname: '/run-job/resources',
      query: {
        ...router.query,
        peerId: nodeInfo.id,
        env: environment.id,
        free: true,
      },
    });
  };

  const getCpuProgressBar = () => {
    if (usageMode) {
      const used = usedAmount(cpu?.id) ?? usedAmount('cpu');
      if (used === undefined) {
        return null;
      }
      const envMax = cpu?.max ?? 0;
      const percentage = envMax > 0 ? Math.min(100, (100 * used) / envMax) : 100;
      return (
        <div className={styles.cpuWrapper}>
          <ProgressBar
            value={percentage}
            topLeftContent={
              <HardwareLabel className={classNames(styles.heading, styles.label)} type="cpu" value={cpu?.description} />
            }
            bottomLeftContent={
              <span className={styles.label}>
                <span className={styles.em}>{used}</span>&nbsp;{used === 1 ? 'core' : 'cores'} used
              </span>
            }
          />
        </div>
      );
    }
    if (!cpu) {
      return null;
    }
    const max = cpu.max ?? 0;
    // From the hook, so the card and the resource picker it leads into report the same number —
    // min(max, total - inUse), not max - inUse (see getAvailableAmount).
    const available = cpuAvailable;
    const fee = cpuFee ?? 0;
    if (compact) {
      return (
        <div className={styles.cpuWrapper}>
          <HardwareLabel className={classNames(styles.heading, styles.label)} type="cpu" value={cpu?.description} />
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
    const percentage = max > 0 ? Math.min(100, (100 * (max - available)) / max) : 100;
    return (
      <div className={styles.cpuWrapper}>
        <ProgressBar
          value={percentage}
          topLeftContent={
            <HardwareLabel className={classNames(styles.heading, styles.label)} type="cpu" value={cpu?.description} />
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
    if (usageMode) {
      const nonGpuIds = new Set([cpu?.id, ram?.id, disk?.id, 'cpu', 'ram', 'disk'].filter(Boolean) as string[]);
      const gpuEntries = (usedResources ?? []).filter((r) => !nonGpuIds.has(r.id));
      return gpuEntries.map((entry) => {
        const envGpu = gpus.find((gpu) => gpu.id === entry.id);
        const envMax = envGpu?.max ?? 0;
        const used = entry.amount;
        const percentage = envMax > 0 ? Math.min(100, (100 * used) / envMax) : 100;
        return (
          <div className={styles.gpuWrapper} key={entry.id}>
            <ProgressBar
              value={percentage}
              topLeftContent={
                <HardwareLabel
                  className={classNames(styles.heading, styles.label)}
                  type="gpu"
                  value={envGpu?.description || 'GPU'}
                />
              }
              bottomLeftContent={
                <span className={styles.label}>
                  <span className={styles.em}>{used}</span>&nbsp;{used === 1 ? 'unit' : 'units'} used
                </span>
              }
            />
          </div>
        );
      });
    }
    // Availability is resolved per resource id BEFORE merging, then summed. It can't be derived from
    // the merged group: `min(max, total - inUse)` needs each member's own `total`, and the merge only
    // sums `max`/`inUse`. Same order the inference card's mergedGpus uses.
    const mergedGpus = gpus.reduce(
      (merged, gpuToCheck) => {
        const existingGpu = merged.find(
          (gpu) => gpu.description === gpuToCheck.description && gpuFees[gpu.id] === gpuFees[gpuToCheck.id]
        );
        if (existingGpu) {
          existingGpu.inUse = (existingGpu.inUse ?? 0) + (gpuToCheck.inUse ?? 0);
          existingGpu.max += gpuToCheck.max;
          existingGpu.available += gpusAvailable[gpuToCheck.id] ?? 0;
        } else {
          merged.push({ ...gpuToCheck, available: gpusAvailable[gpuToCheck.id] ?? 0 });
        }
        return merged;
      },
      [] as Array<(typeof gpus)[number] & { available: number }>
    );
    return mergedGpus.map((gpu) => {
      const max = gpu.max ?? 0;
      const available = gpu.available;
      const fee = gpuFees[gpu.id] ?? 0;
      if (compact) {
        return (
          <div className={styles.gpuWrapper} key={gpu.id}>
            <HardwareLabel
              className={classNames(styles.heading, styles.label)}
              type="gpu"
              value={gpu.description || 'GPU'}
            />
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
      const percentage = max > 0 ? Math.min(100, (100 * (max - available)) / max) : 100;
      return (
        <div className={styles.gpuWrapper} key={gpu.id}>
          <ProgressBar
            value={percentage}
            topLeftContent={
              <HardwareLabel
                className={classNames(styles.heading, styles.label)}
                type="gpu"
                value={gpu.description || 'GPU'}
              />
            }
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
    if (usageMode) {
      const used = usedAmount(ram?.id) ?? usedAmount('ram');
      if (used === undefined) {
        return null;
      }
      const envMax = ram?.max ?? 0;
      const percentage = envMax > 0 ? Math.min(100, (100 * used) / envMax) : 100;
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
                <span className={styles.em}>{used}</span>&nbsp;GB used
              </span>
            }
          />
        </div>
      );
    }
    if (!ram) {
      return null;
    }
    const max = ram.max ?? 0;
    // From the hook, so the card and the resource picker it leads into report the same number —
    // min(max, total - inUse), not max - inUse (see getAvailableAmount).
    const available = ramAvailable;
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
    const percentage = max > 0 ? Math.min(100, (100 * (max - available)) / max) : 100;
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
    if (usageMode) {
      const used = usedAmount(disk?.id) ?? usedAmount('disk');
      if (used === undefined) {
        return null;
      }
      const envMax = disk?.max ?? 0;
      const percentage = envMax > 0 ? Math.min(100, (100 * used) / envMax) : 100;
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
                <span className={styles.em}>{used}</span>&nbsp;GB used
              </span>
            }
          />
        </div>
      );
    }
    if (!disk) {
      return null;
    }
    const max = disk.max ?? 0;
    // From the hook, so the card and the resource picker it leads into report the same number —
    // min(max, total - inUse), not max - inUse (see getAvailableAmount).
    const available = diskAvailable;
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
    const percentage = max > 0 ? Math.min(100, (100 * (max - available)) / max) : 100;
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
    if (usageMode || !environment.free || forcePricing) {
      return null;
    }
    const isLoggedIn = freeAccess !== null;
    const isDisabled = !isLoggedIn || !freeAccess;
    const label = 'Test compute';
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
                <InfoOutlinedIcon className={styles.infoIcon} />
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

  const getInternetAccessLabel = () => {
    const hasInternet = !!environment.enableNetwork;
    return (
      <div className={styles.internetAccess}>
        {hasInternet ? (
          <PublicIcon className={styles.icon} />
        ) : (
          <PublicOffIcon className={classNames(styles.icon, styles.noInternet)} />
        )}
        <span>Internet:&nbsp;</span>
        <strong>{hasInternet ? 'Yes' : 'No'}</strong>
        <Tooltip
          title={
            hasInternet
              ? 'Jobs in this environment can access the internet'
              : 'Jobs in this environment run without internet access'
          }
        >
          <InfoOutlinedIcon className={styles.infoIcon} />
        </Tooltip>
      </div>
    );
  };

  const getRunJobButton = () => {
    const isLoggedIn = freeAccess !== null && paidAccess !== null;
    const isDisabled = !isLoggedIn || (isFreeCompute && !freeAccess) || (!isFreeCompute && !paidAccess);
    const button = (
      <Button
        className={styles.selectEnvButton}
        color="accent1"
        contentBefore={<PlayArrowIcon />}
        disabled={isDisabled}
        onClick={isFreeCompute ? selectFreeCompute : selectEnvironment}
      >
        {isFreeCompute
          ? 'Run test job'
          : `From ${formatTokenAmount(startingFee, selectedTokenAddress)} ${selectedTokenSymbol}/min`}
      </Button>
    );
    if (isDisabled) {
      return (
        <Tooltip
          title={
            isLoggedIn
              ? isFreeCompute
                ? "Your wallet address is not in this environment's test compute access list"
                : "Your wallet address is not in this environment's paid compute access list"
              : 'You need to login to continue'
          }
        >
          <div className="flexColumn">{button}</div>
        </Tooltip>
      );
    }
    return button;
  };

  return (
    <Card className={styles.root} direction="column" innerShadow="black" padding="sm" radius="md" variant="glass">
      {showNodeInfo ? (
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
      ) : null}

      <div>
        <TransitionGroup>
          {!noResourcesAvailable ? (
            <Collapse>
              <div className={styles.gridWrapper}>
                {usageMode ? (
                  <>
                    <h4>Resources used</h4>
                    <div className={classNames(styles.grid)}>
                      {getGpuProgressBars()}
                      {getCpuProgressBar()}
                      {getRamProgressBar()}
                      {getDiskProgressBar()}
                    </div>
                  </>
                ) : compact ? (
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
          {getInternetAccessLabel()}
          <div>
            Job duration:&nbsp;
            <strong>
              {usageMode
                ? jobDurationSeconds != null
                  ? formatDuration(jobDurationSeconds)
                  : '—'
                : `${formatDuration(minJobDurationSeconds ?? 0)} - ${formatDuration(maxJobDurationSeconds ?? 0)}`}
            </strong>
          </div>
          {getFreeComputeCheckbox()}
        </div>
        <div className={styles.buttons}>
          {Object.entries(supportedTokensSymbols).length > 1 && !isFreeCompute && !usageMode ? (
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
