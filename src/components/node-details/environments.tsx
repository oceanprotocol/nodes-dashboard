import Card from '@/components/card/card';
import EnvironmentCard from '@/components/environment-card/environment-card';
import { useP2P } from '@/contexts/P2PContext';
import { EnvNodeInfo } from '@/types/environments';
import styles from './environments.module.css';

type EnvironmentsProps = {
    nodeInfo: EnvNodeInfo;
};

const Environments = ({ nodeInfo }: EnvironmentsProps) => {
  const { isReady, envs } = useP2P();

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Environments</h3>
      <div className={styles.list}>
        {!isReady ? <div>Fetching data...</div> : envs.map((env) =>
          <EnvironmentCard key={env.id} environment={env} nodeInfo={nodeInfo} />
        )}
      </div>
    </Card>
  );
};

export default Environments;
