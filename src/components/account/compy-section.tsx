import Card from '@/components/card/card';
import SwapTokens from '@/components/swap-tokens/swap-tokens';
import styles from './compy-section.module.css';

const CompySection = () => {
  return (
    <Card className={styles.root} direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <SwapTokens refetchOnSuccess />
    </Card>
  );
};

export default CompySection;
