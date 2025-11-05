import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Select from '@/components/input/select';
import ProgressBar from '@/components/progress-bar/progress-bar';
import { MOCK_ENV } from '@/mock/environments';
import DnsIcon from '@mui/icons-material/Dns';
import MemoryIcon from '@mui/icons-material/Memory';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import classNames from 'classnames';
import { useState } from 'react';
import styles from './environment-card.module.css';

// TODO replace mock data

// TODO show balance + withdraw button

type EnvironmentCardProps = {
  compact?: boolean;
  showBalance?: boolean;
  showNodeName?: boolean;
};

const EnvironmentCard = ({ compact, showBalance, showNodeName }: EnvironmentCardProps) => {
  const [token, setToken] = useState(MOCK_ENV.supportedTokens[0]);

  // TODO replace random with real check
  const hasBalance = Math.random() > 0.5;

  const getCpuProgressBar = () => {
    if (compact) {
      const available = MOCK_ENV.cpu.max - MOCK_ENV.cpu.used;
      return (
        <div>
          <div className={styles.label}>
            <MemoryIcon className={styles.icon} />
            <span className={styles.heading}>{MOCK_ENV.cpu.name}</span>
          </div>
          <div className={styles.label}>
            <span className={styles.em}>{MOCK_ENV.cpu.unitPrice[token]}</span>&nbsp;{token}/min
          </div>
          <div className={styles.label}>
            <span className={styles.em}>
              {available}/{MOCK_ENV.cpu.max}
            </span>
            &nbsp; available
          </div>
        </div>
      );
    }
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
            <span className={styles.em}>{MOCK_ENV.cpu.unitPrice[token]}</span>&nbsp;{token}/min
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
      if (compact) {
        const available = gpu.max - gpu.used;
        return (
          <div key={gpu.name}>
            <div className={styles.label}>
              <MemoryIcon className={styles.icon} />
              <span className={styles.heading}>{gpu.name}</span>
            </div>
            <div className={styles.label}>
              <span className={styles.em}>{gpu.unitPrice[token]}</span>&nbsp;{token}/min
            </div>
            <div className={styles.label}>
              <span className={styles.em}>
                {available}/{gpu.max}
              </span>
              &nbsp;available
            </div>
          </div>
        );
      }
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
              <span className={styles.em}>{gpu.unitPrice[token]}</span>&nbsp;{token}/min
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
    if (compact) {
      const available = MOCK_ENV.ram.max - MOCK_ENV.ram.used;
      return (
        <div>
          <div className={styles.label}>
            <SdStorageIcon className={styles.icon} />
            <span className={styles.heading}>GB RAM capacity</span>
          </div>
          <div className={styles.label}>
            <span className={styles.em}>{MOCK_ENV.ram.unitPrice[token]}</span>&nbsp;{token}/min
          </div>
          <div className={styles.label}>
            <span className={styles.em}>
              {available}/{MOCK_ENV.ram.max}
            </span>
            &nbsp;available
          </div>
        </div>
      );
    }
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
            <span className={styles.em}>{MOCK_ENV.ram.unitPrice[token]}</span>&nbsp;{token}/min
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
    if (compact) {
      const available = MOCK_ENV.disk.max - MOCK_ENV.disk.used;
      return (
        <div>
          <div className={styles.label}>
            <DnsIcon className={styles.icon} />
            <span className={styles.heading}>GB Disk space</span>
          </div>
          <div className={styles.label}>
            <span className={styles.em}>{MOCK_ENV.disk.unitPrice[token]}</span>&nbsp;{token}/min
          </div>
          <div className={styles.label}>
            <span className={styles.em}>
              {available}/{MOCK_ENV.disk.max}
            </span>
            &nbsp;available
          </div>
        </div>
      );
    }
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
            <span className={styles.em}>{MOCK_ENV.disk.unitPrice[token]}</span>&nbsp;{token}/min
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
        {compact ? (
          <div className={classNames(styles.compactGrid)}>
            {getGpuProgressBars()}
            {getCpuProgressBar()}
            {getRamProgressBar()}
            {getDiskProgressBar()}
          </div>
        ) : MOCK_ENV.gpu.length === 1 ? (
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
      {showBalance ? (
        <div className={styles.balance}>
          {hasBalance ? (
            <div className="chip chipSuccess">Funds available</div>
          ) : (
            <div className="chip chipError">Top-up required</div>
          )}
          <div>
            Balance: <strong>{hasBalance ? 100 : 0}</strong> OCEAN
          </div>
          {hasBalance ? (
            <a className={styles.link} href="/withdraw">
              Withdraw
            </a>
          ) : null}
        </div>
      ) : null}
      <div className={styles.footer}>
        <div>
          <div>
            Max job duration: <strong>{MOCK_ENV.maxJobDuration}</strong> seconds
          </div>
          {showNodeName ? (
            <div>
              Node: <strong>Friendly node name</strong>
            </div>
          ) : null}
        </div>
        <div className={styles.buttons}>
          <Select
            className={styles.select}
            onChange={(e) => setToken(e.target.value)}
            options={MOCK_ENV.supportedTokens.map((token) => ({ label: token, value: token }))}
            size="sm"
            value={token}
          />
          {MOCK_ENV.freeComputeEnvId ? (
            <Button color="accent2" href="/run-job/resources" variant="outlined">
              Try it
            </Button>
          ) : null}
          <Button color="accent2" contentBefore={<PlayArrowIcon />} href="/run-job/resources">
            From {MOCK_ENV.minPricePerMinute[token]}/min
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default EnvironmentCard;
