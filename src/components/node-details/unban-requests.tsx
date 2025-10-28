import Button from '@/components/button/button';
import Card from '@/components/card/card';
import styles from './unban-requests.module.css';

export const UnbanRequests = () => {
  return (
    <Card padding="md" radius="lg" variant="glass-shaded">
      <div className={styles.header}>
        <h3>Unban requests</h3>
        <Button>Request unban</Button>
      </div>
    </Card>
  );
};
