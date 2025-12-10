import Button from '@/components/button/button';
import Card from '@/components/card/card';
import useEnvResources from '@/components/hooks/use-env-resources';
import ProgressBar from '@/components/progress-bar/progress-bar';
import { useRunJobContext } from '@/context/run-job-context';
import { ComputeEnvironment } from '@/types/environments';
import { getEnvSupportedTokens } from '@/utils/env-tokens';
import { formatNumber } from '@/utils/formatters';
import DnsIcon from '@mui/icons-material/Dns';
import MemoryIcon from '@mui/icons-material/Memory';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import styles from './environment-card.module.css';

type EnvironmentCardProps = {
  compact?: boolean;
  environment: ComputeEnvironment;
  showNodeName?: boolean;
};

const EnvironmentCard = ({ compact, environment, showNodeName }: EnvironmentCardProps) => {
  const router = useRouter();

  const { selectEnv, selectToken } = useRunJobContext();

  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string | null>(
    getEnvSupportedTokens(environment)[0]
  );

  const { cpu, cpuFee, disk, diskFee, gpus, gpuFees, ram, ramFee, tokenSymbol } = useEnvResources(
    environment,
    selectedTokenAddress
  );

  const startingFee = useMemo(() => {
    const minGpuFee = Object.values(gpuFees).reduce((min, fee) => (fee < min ? fee : min), Infinity);
    return (cpuFee ?? 0) + (ramFee ?? 0) + (diskFee ?? 0) + (minGpuFee === Infinity ? 0 : minGpuFee);
  }, [cpuFee, diskFee, gpuFees, ramFee]);

  const maxJobDurationHours = (environment.maxJobDuration ?? 0) / 60 / 60;

  const selectEnvironment = () => {
    selectEnv(environment);
    if (selectedTokenAddress) {
      selectToken(selectedTokenAddress, tokenSymbol);
    }
    router.push('/run-job/resources');
  };

  const selectFreeCompute = () => {
    selectEnv({
      ...environment,
      ...environment.free,
      fees: {},
      free: undefined,
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
        <div>
          <div className={styles.label}>
            <MemoryIcon className={styles.icon} />
            <span className={styles.heading}>{cpu?.description}</span>
          </div>
          <div className={styles.label}>
            <span className={styles.em}>{fee}</span>&nbsp;{tokenSymbol}/min
          </div>
          <div className={styles.label}>
            <span className={styles.em}>
              {available}/{max}
            </span>
            &nbsp; available
          </div>
        </div>
      );
    }
    const percentage = (100 * inUse) / max;
    return (
      <ProgressBar
        value={percentage}
        topLeftContent={
          <span className={classNames(styles.label, styles.em)}>
            <MemoryIcon className={styles.icon} /> CPU - {cpu?.description}
          </span>
        }
        topRightContent={
          <span className={styles.label}>
            <span className={styles.em}>{max}</span>&nbsp;total
          </span>
        }
        bottomLeftContent={
          <span className={styles.label}>
            <span className={styles.em}>{fee}</span>&nbsp;{tokenSymbol}/min
          </span>
        }
        bottomRightContent={
          <span className={styles.label}>
            <span className={styles.em}>{inUse}</span>&nbsp;used
          </span>
        }
      />
    );
  };

  const getGpuProgressBars = () => {
    return gpus.map((gpu) => {
      const max = gpu.max ?? 0;
      const inUse = gpu.inUse ?? 0;
      const available = max - inUse;
      const fee = gpuFees[gpu.id] ?? 0;
      if (compact) {
        return (
          <div key={gpu.id}>
            <div className={styles.label}>
              <MemoryIcon className={styles.icon} />
              <span className={styles.heading}>{gpu.description}</span>
            </div>
            <div className={styles.label}>
              <span className={styles.em}>{fee}</span>&nbsp;{tokenSymbol}/min
            </div>
            <div className={styles.label}>
              <span className={styles.em}>
                {available}/{max}
              </span>
              &nbsp;available
            </div>
          </div>
        );
      }
      const percentage = (100 * inUse) / max;
      return (
        <ProgressBar
          key={gpu.id}
          value={percentage}
          topLeftContent={
            <span className={classNames(styles.label, styles.em)}>
              <MemoryIcon className={styles.icon} /> GPU - {gpu.description}
            </span>
          }
          topRightContent={
            <span className={styles.label}>
              <span className={styles.em}>{max}</span>&nbsp;total
            </span>
          }
          bottomLeftContent={
            <span className={styles.label}>
              <span className={styles.em}>{fee}</span>&nbsp;{tokenSymbol}/min
            </span>
          }
          bottomRightContent={
            <span className={styles.label}>
              <span className={styles.em}>{inUse}</span>&nbsp;used
            </span>
          }
        />
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
        <div>
          <div className={styles.label}>
            <SdStorageIcon className={styles.icon} />
            <span className={styles.heading}>GB RAM capacity</span>
          </div>
          <div className={styles.label}>
            <span className={styles.em}>{fee}</span>&nbsp;{tokenSymbol}/min
          </div>
          <div className={styles.label}>
            <span className={styles.em}>
              {available}/{max}
            </span>
            &nbsp;available
          </div>
        </div>
      );
    }
    const percentage = (100 * inUse) / max;
    return (
      <ProgressBar
        value={percentage}
        topLeftContent={
          <span className={classNames(styles.label, styles.em)}>
            <SdStorageIcon className={styles.icon} /> RAM capacity
          </span>
        }
        topRightContent={
          <span className={styles.label}>
            <span className={styles.em}>{max}</span>&nbsp;GB total
          </span>
        }
        bottomLeftContent={
          <span className={styles.label}>
            <span className={styles.em}>{fee}</span>&nbsp;{tokenSymbol}/min
          </span>
        }
        bottomRightContent={
          <span className={styles.label}>
            <span className={styles.em}>{inUse}</span>&nbsp;GB used
          </span>
        }
      />
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
        <div>
          <div className={styles.label}>
            <DnsIcon className={styles.icon} />
            <span className={styles.heading}>GB Disk space</span>
          </div>
          <div className={styles.label}>
            <span className={styles.em}>{fee}</span>&nbsp;{tokenSymbol}/min
          </div>
          <div className={styles.label}>
            <span className={styles.em}>
              {available}/{max}
            </span>
            &nbsp;available
          </div>
        </div>
      );
    }
    const percentage = (100 * inUse) / max;
    return (
      <ProgressBar
        value={percentage}
        topLeftContent={
          <span className={classNames(styles.label, styles.em)}>
            <DnsIcon className={styles.icon} /> Disk space
          </span>
        }
        topRightContent={
          <span className={styles.label}>
            <span className={styles.em}>{max}</span>&nbsp;GB total
          </span>
        }
        bottomLeftContent={
          <span className={styles.label}>
            <span className={styles.em}>{fee}</span>&nbsp;{tokenSymbol}/min
          </span>
        }
        bottomRightContent={
          <span className={styles.label}>
            <span className={styles.em}>{inUse}</span>&nbsp;GB used
          </span>
        }
      />
    );
  };

  return (
    <Card direction="column" padding="sm" radius="md" spacing="lg" variant="glass">
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
      <div className={styles.footer}>
        <div>
          <div>
            Max job duration: <strong>{formatNumber(maxJobDurationHours)}</strong> hours
          </div>
          {showNodeName ? (
            <div>
              Node: <strong>Friendly node name</strong>
            </div>
          ) : null}
        </div>
        <div className={styles.buttons}>
          {environment.free ? (
            <Button color="accent2" href="/run-job/resources" onClick={selectFreeCompute} variant="outlined">
              Try it
            </Button>
          ) : null}
          <Button color="accent2" contentBefore={<PlayArrowIcon />} onClick={selectEnvironment}>
            From {startingFee} {tokenSymbol}/min
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default EnvironmentCard;
