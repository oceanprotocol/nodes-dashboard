import Card from '@/components/card/card';
import EnvironmentCard from '@/components/environment-card/environment-card';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { useP2P } from '@/contexts/P2PContext';
import { EnvNodeInfo } from '@/types/environments';
import { useMemo } from 'react';
import styles from './environments.module.css';

type EnvironmentsProps = {
  nodeInfo: EnvNodeInfo;
};

const Environments = ({ nodeInfo }: EnvironmentsProps) => {
  const { isReady, envs } = useP2P();

  // Only show environments that support chain ID and USDC/COMPY
  const filteredEnvs = useMemo(
    () =>
      envs.filter((env) => {
        if (!env.fees?.[CHAIN_ID]) {
          return false;
        }
        if (
          !env.fees[CHAIN_ID].some(
            (fee) =>
              fee.feeToken.toLowerCase() === getSupportedTokens().COMPY.address.toLowerCase() ||
              fee.feeToken.toLowerCase() === getSupportedTokens().USDC.address.toLowerCase()
          )
        ) {
          return false;
        }
        return true;
      }),
    [envs]
  );

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Environments</h3>
      <div className={styles.list}>
        {!isReady ? (
          <div>Fetching data...</div>
        ) : filteredEnvs.length ? (
          filteredEnvs.map((env) => <EnvironmentCard key={env.id} environment={env} nodeInfo={nodeInfo} />)
        ) : (
          <div>No environments</div>
        )}
      </div>
    </Card>
  );
};

export default Environments;
