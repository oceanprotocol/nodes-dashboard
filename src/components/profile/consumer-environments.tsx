import Card from '@/components/card/card';
import EnvironmentCard from '@/components/environment-card/environment-card';
import { MOCK_ENVS } from '@/mock/environments';
import styles from './consumer-environments.module.css';

const ConsumerEnvironments = () => {
  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Environments used</h3>
      <div className={styles.list}>
        {MOCK_ENVS.map((env) => (
          <EnvironmentCard environment={env} key={env.id} showBalance showNodeName />
        ))}
      </div>
    </Card>
  );
};

export default ConsumerEnvironments;
