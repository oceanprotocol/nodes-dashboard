import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Select from '@/components/input/select';
import ProgressBar from '@/components/progress-bar/progress-bar';
import DnsIcon from '@mui/icons-material/Dns';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import classNames from 'classnames';
import { useState } from 'react';
import styles from './environment-card.module.css';

// TODO replace mock data

const MOCK_ENV = {
  maxJobDuration: 7000,
  minPricePerMinute: 350,
  cpu: {
    max: 32,
    name: 'Intel Xeon E5-2673 v4',
    unitPrice: {
      OCEAN: 3,
      USDC: 1.51,
    } as Record<string, number>,
    used: 12,
  },
  disk: {
    max: 32,
    unitPrice: {
      OCEAN: 6,
      USDC: 2.51,
    } as Record<string, number>,
    used: 8,
  },
  gpu: [
    {
      max: 32,
      name: 'nVIDIA RTX 5090',
      unitPrice: {
        OCEAN: 100,
        USDC: 50,
      } as Record<string, number>,
      used: 30,
    },
    {
      max: 32,
      name: 'nVIDIA RTX 4090',
      unitPrice: {
        OCEAN: 3,
        USDC: 1.51,
      } as Record<string, number>,
      used: 3,
    },
    {
      max: 32,
      name: 'nVIDIA RTX 5080',
      unitPrice: {
        OCEAN: 6,
        USDC: 2.51,
      } as Record<string, number>,
      used: 2,
    },
    {
      max: 32,
      name: 'nVIDIA RTX 4080',
      unitPrice: {
        OCEAN: 30,
        USDC: 10.51,
      } as Record<string, number>,
      used: 8,
    },
  ],
  ram: {
    max: 32,
    unitPrice: {
      OCEAN: 30,
      USDC: 10.51,
    } as Record<string, number>,
    used: 20,
  },
  supportedTokens: ['OCEAN', 'USDC'],
};

const EnvironmentCard = () => {
  const [token, setToken] = useState(MOCK_ENV.supportedTokens[0]);

  const getCpuProgressBar = () => {
    const percentage = (100 * MOCK_ENV.cpu.used) / MOCK_ENV.cpu.max;
    return (
      <ProgressBar
        value={percentage}
        topLeftContent={
          <span className={classNames(styles.label, styles.em)}>
            <MemoryIcon className={styles.icon} /> CPU - {MOCK_ENV.cpu.name}
          </span>
        }
        topRightContent={
          <span className={styles.label}>
            <span className={styles.em}>{MOCK_ENV.cpu.max}</span>&nbsp;total
          </span>
        }
        bottomLeftContent={
          <span className={styles.label}>
            <span className={styles.em}>{MOCK_ENV.cpu.unitPrice[token]}</span>&nbsp;{token} / core
          </span>
        }
        bottomRightContent={
          <span className={styles.label}>
            <span className={styles.em}>{MOCK_ENV.cpu.used}</span>&nbsp;used
          </span>
        }
      />
    );
  };

  const getGpuProgressBars = () => {
    return MOCK_ENV.gpu.map((gpu, index) => {
      const percentage = (100 * gpu.used) / gpu.max;
      return (
        <ProgressBar
          key={index}
          value={percentage}
          topLeftContent={
            <span className={classNames(styles.label, styles.em)}>
              <MemoryIcon className={styles.icon} /> GPU - {gpu.name}
            </span>
          }
          topRightContent={
            <span className={styles.label}>
              <span className={styles.em}>{gpu.max}</span>&nbsp;total
            </span>
          }
          bottomLeftContent={
            <span className={styles.label}>
              <span className={styles.em}>{gpu.unitPrice[token]}</span>&nbsp;{token} / GPU
            </span>
          }
          bottomRightContent={
            <span className={styles.label}>
              <span className={styles.em}>{gpu.used}</span>&nbsp;used
            </span>
          }
        />
      );
    });
  };

  const getRamProgressBar = () => {
    const percentage = (100 * MOCK_ENV.ram.used) / MOCK_ENV.ram.max;
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
            <span className={styles.em}>{MOCK_ENV.ram.max}</span>&nbsp;GB total
          </span>
        }
        bottomLeftContent={
          <span className={styles.label}>
            <span className={styles.em}>{MOCK_ENV.ram.unitPrice[token]}</span>&nbsp;{token} / GB
          </span>
        }
        bottomRightContent={
          <span className={styles.label}>
            <span className={styles.em}>{MOCK_ENV.ram.used}</span>&nbsp;GB used
          </span>
        }
      />
    );
  };

  const getDiskProgressBar = () => {
    const percentage = (100 * MOCK_ENV.disk.used) / MOCK_ENV.disk.max;
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
            <span className={styles.em}>{MOCK_ENV.disk.max}</span>&nbsp;GB total
          </span>
        }
        bottomLeftContent={
          <span className={styles.label}>
            <span className={styles.em}>{MOCK_ENV.disk.unitPrice[token]}</span>&nbsp;{token} / GB
          </span>
        }
        bottomRightContent={
          <span className={styles.label}>
            <span className={styles.em}>{MOCK_ENV.disk.used}</span>&nbsp;GB used
          </span>
        }
      />
    );
  };

  return (
    <Card direction="column" padding="sm" radius="md" spacing="lg" variant="glass">
      <div className={styles.gridWrapper}>
        {MOCK_ENV.gpu.length === 1 ? (
          <>
            <h4>Specs</h4>
            <div className={classNames(styles.grid, styles.allSpecs)}>
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
          Max job duration: <strong>{MOCK_ENV.maxJobDuration}</strong> seconds
        </div>
        <div className={styles.buttons}>
          <Select
            className={styles.select}
            onChange={(e) => setToken(e.target.value)}
            options={MOCK_ENV.supportedTokens.map((token) => ({ label: token, value: token }))}
            value={token}
          />
          <Button>Try it</Button>
          <Button>From {MOCK_ENV.minPricePerMinute}/min</Button>
        </div>
      </div>
    </Card>
  );
};

export default EnvironmentCard;
