import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import { getSupportedTokens } from '@/constants/tokens';
import { ComputeEnvironment } from '@/types/environments';
import DnsIcon from '@mui/icons-material/Dns';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import classNames from 'classnames';
import styles from './node-preview.module.css';

type NodePreviewProps = {
  nodeConfig: Record<string, any>;
};

const NodePreview = ({ nodeConfig }: NodePreviewProps) => {
  return (
    <Card direction="column" padding="sm" radius="md" spacing="md" variant="glass">
      <h3>Preview configuration</h3>
      {nodeConfig.dockerComputeEnvironments?.length > 0 ? (
        nodeConfig.dockerComputeEnvironments?.map((env: ComputeEnvironment, index: number) => (
          <NodeEnvPreview
            key={index}
            environment={env}
            index={index}
            showEnvName={nodeConfig.dockerComputeEnvironments?.length > 1}
          />
        ))
      ) : (
        <p>No valid compute environments to display</p>
      )}
    </Card>
  );
};

const NodeEnvPreview = ({
  environment,
  index,
  showEnvName,
}: {
  environment: ComputeEnvironment;
  index: number;
  showEnvName?: boolean;
}) => {
  const { cpu, cpuFee, disk, diskFee, gpus, gpuFees, ram, ramFee } = useEnvResources({
    environment,
    freeCompute: false,
    tokenAddress: getSupportedTokens().USDC,
  });

  // TODO
  const tokenSymbol = 'USDC';

  const renderCpu = () => {
    if (!cpu) {
      return null;
    }
    const max = cpu.max ?? cpu.total ?? 0;
    const fee = cpuFee ?? 0;
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
          <span className={styles.em}>1 - {max}</span>
          &nbsp; available
        </div>
      </div>
    );
  };

  const renderGpus = () => {
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
      const max = gpu.max ?? gpu.total ?? 0;
      const fee = gpuFees[gpu.id] ?? 0;
      return (
        <div key={gpu.id}>
          <GpuLabel className={classNames(styles.heading, styles.label)} gpu={gpu.description} />
          <div className={styles.label}>
            <span className={styles.em}>{fee}</span>&nbsp;{tokenSymbol}/min
          </div>
          <div className={styles.label}>
            <span className={styles.em}>0 - {max}</span>
            &nbsp;available
          </div>
        </div>
      );
    });
  };

  const renderRam = () => {
    if (!ram) {
      return null;
    }
    const max = ram.max ?? ram.total ?? 0;
    const fee = ramFee ?? 0;
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
          <span className={styles.em}>0 - {max}</span>
          &nbsp;available
        </div>
      </div>
    );
  };

  const renderDisk = () => {
    if (!disk) {
      return null;
    }
    const max = disk.max ?? disk.total ?? 0;
    const fee = diskFee ?? 0;
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
          <span className={styles.em}>0 - {max}</span>
          &nbsp;available
        </div>
      </div>
    );
  };
  return (
    <div className={styles.envWrapper}>
      {showEnvName ? <h4>Environment {index}</h4> : null}
      <div className={classNames(styles.grid)}>
        {renderGpus()}
        {renderCpu()}
        {renderRam()}
        {renderDisk()}
      </div>
    </div>
  );
};

export default NodePreview;
