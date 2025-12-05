import Card from '@/components/card/card';
import EnvironmentCard from '@/components/environment-card/environment-card';
import { useP2P } from '@/contexts/P2PContext.api';
import { Node } from '@/types';
import { useEffect } from 'react';
import styles from './environments.module.css';

type EnvironmentsProps = {
  node: Node;
};

const Environments = ({ node }: EnvironmentsProps) => {
  const { envs, isReady, getEnvs } = useP2P();

  useEffect(() => {
    if (node?.id && isReady) {
      console.log('acum e acum')
      setTimeout(() => getEnvs(node.id!), 5000)
    }
  }, [node?.id, isReady, getEnvs]);

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Environments</h3>
      <div className={styles.list}>
        {envs.map((env) => (
          <EnvironmentCard key={env.id} environment={env} />
        ))}
      </div>
    </Card>
  );
};

export default Environments;
