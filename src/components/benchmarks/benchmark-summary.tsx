import Divider from '@/components/divider/divider.module';
import { calculateTotalBenchmarkScore } from '@/utils/benchmark-score';
import HomeMaxIcon from '@mui/icons-material/HomeMax';
import MemoryIcon from '@mui/icons-material/Memory';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import classNames from 'classnames';
import { useMemo } from 'react';
import styles from './benchmark-summary.module.css';

type BenchmarkSummaryProps = {
  bandwidthScore?: number;
  cpuScore?: number;
  gpuScore?: number;
  totalScore?: number;
};

const BenchmarkSummary: React.FC<BenchmarkSummaryProps> = ({ bandwidthScore, cpuScore, gpuScore, totalScore }) => {
  const formatScore = (value: number | null | undefined) => {
    if (value || value === 0) {
      return Math.round(value).toLocaleString();
    }
    return '-';
  };

  const { formattedBandwidth, formattedCpu, formattedGpu, formattedTotal } = useMemo(() => {
    const total = totalScore ?? calculateTotalBenchmarkScore(gpuScore, cpuScore, bandwidthScore);
    return {
      formattedBandwidth: formatScore(bandwidthScore),
      formattedCpu: formatScore(cpuScore),
      formattedGpu: formatScore(gpuScore),
      formattedTotal: formatScore(total),
    };
  }, [gpuScore, cpuScore, bandwidthScore, totalScore]);

  return (
    <div className={classNames('chip', 'chipPrimaryOutlined', styles.root)}>
      <div className={styles.label}>Benchmark:</div>
      <div className={styles.result} title={`GPU score: ${formattedGpu}`}>
        <HomeMaxIcon className={styles.icon} /> {formattedGpu}
      </div>
      <Divider className={styles.divider} orientation="vertical" />
      <div className={styles.result} title={`CPU score: ${formattedCpu}`}>
        <MemoryIcon className={styles.icon} /> {formattedCpu}
      </div>
      <Divider className={styles.divider} orientation="vertical" />
      <div className={styles.result} title={`Bandwidth score: ${formattedBandwidth}`}>
        <NetworkCheckIcon className={styles.icon} /> {formattedBandwidth}
      </div>
      <Divider className={styles.divider} orientation="vertical" />
      <div className={classNames(styles.result, styles.total)}>Total: {formattedTotal}</div>
    </div>
  );
};

export default BenchmarkSummary;
