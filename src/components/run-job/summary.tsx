import Button from '@/components/button/button';
import Card from '@/components/card/card';
import styles from './summary.module.css';

// TODO replace mock data

const Summary = () => {
  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Your selection</h3>
      <div className={styles.grid}>
        <div className={styles.label}>Node name:</div>
        <div className={styles.value}>Friendly Name 1</div>
        <div className={styles.label}>Node address:</div>
        <div className={styles.value}>0x7087B048A37186aE52A27908Bebd342114C6d8f3</div>
        <div className={styles.label}>Environment:</div>
        <div className={styles.value}>0x7087B048A37186aE52A27908Bebd342114C6d8f3</div>
        <div className={styles.label}>Fee token address:</div>
        <div className={styles.value}>0x7087B048A37186aE52A27908Bebd342114C6d8f3</div>
        <div className={styles.label}>Job duration:</div>
        <div className={styles.value}>7000 seconds</div>
        <div className={styles.label}>GPU:</div>
        <div className={styles.value}>nVIDIA RTX 5090</div>
        <div className={styles.label}>CPU cores:</div>
        <div className={styles.value}>2</div>
        <div className={styles.label}>RAM:</div>
        <div className={styles.value}>16 GB</div>
        <div className={styles.label}>Disk space:</div>
        <div className={styles.value}>100 GB</div>
        <div className={styles.label}>Total cost</div>
        <div className={styles.value}>OCEAN 100.5</div>
      </div>
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
