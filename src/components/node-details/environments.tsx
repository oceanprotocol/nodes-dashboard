import Card from '@/components/card/card';
import EnvironmentCard from '@/components/environment-card/environment-card';
import styles from './environments.module.css';

const Environments = () => {
  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Environments</h3>
      <div className={styles.list}>
        <EnvironmentCard />
        <EnvironmentCard />
      </div>
    </Card>
  );
};

export default Environments;
