import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import { CHAIN_ID } from '@/constants/chains';
import { ComputeEnvironment, EnvResourcesSelection } from '@/types/environments';
import classNames from 'classnames';
import styles from './summary.module.css';

type SummaryProps = {
  estimatedTotalCost: number;
  selectedEnv: ComputeEnvironment;
  selectedResources: EnvResourcesSelection;
};

const Summary = ({ estimatedTotalCost, selectedEnv, selectedResources }: SummaryProps) => {
  const feeTokenAddress = selectedEnv.fees?.[CHAIN_ID]?.[0]?.feeToken;

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Your selection</h3>
      <div className={styles.grid}>
        {/* // TODO replace mock data */}
        <div className={styles.label}>Node name:</div>
        <div className={styles.value}>Friendly Name 1</div>
        {/* // TODO replace mock data */}
        <div className={styles.label}>Node address:</div>
        <div className={styles.value}>0x7087B048A37186aE52A27908Bebd342114C6d8f3</div>
        {/* // TODO replace mock data */}
        <div className={styles.label}>Environment:</div>
        <div className={styles.value}>0x7087B048A37186aE52A27908Bebd342114C6d8f3</div>
        {feeTokenAddress ? (
          <>
            <div className={styles.label}>Fee token address:</div>
            <div className={styles.value}>{feeTokenAddress}</div>
          </>
        ) : null}
        <div className={styles.label}>Job duration:</div>
        <div className={styles.value}>{selectedResources!.maxJobDurationHours} hours</div>
        <div className={styles.label}>GPU:</div>
        <div className={classNames(styles.value, styles.gpus)}>
          {selectedResources!.gpus.map((gpu) => (
            <GpuLabel key={gpu.id} gpu={gpu.description} />
          ))}
        </div>
        <div className={styles.label}>CPU cores:</div>
        <div className={styles.value}>{selectedResources!.cpuCores}</div>
        <div className={styles.label}>RAM:</div>
        <div className={styles.value}>{selectedResources!.ram} GB</div>
        <div className={styles.label}>Disk space:</div>
        <div className={styles.value}>{selectedResources!.diskSpace} GB</div>
        <div className={styles.label}>Total cost</div>
        <div className={styles.value}>{estimatedTotalCost} USDC</div>
      </div>
      {/* // TODO button actions */}
      <div className={styles.footer}>
        <div>Continue on our VSCode extension, or select your editor of choice</div>
        <div className={styles.buttons}>
          <Button color="accent2" size="lg" variant="outlined">
            Choose editor
          </Button>
          <Button color="accent2" size="lg">
            Open VSCode
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default Summary;
