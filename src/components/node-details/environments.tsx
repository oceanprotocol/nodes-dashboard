import Button from '@/components/button/button';
import Card from '@/components/card/card';
import EnvironmentCard from '@/components/environment-card/environment-card';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { useP2P } from '@/contexts/P2PContext';
import { EnvNodeInfo } from '@/types/environments';
import { Collapse } from '@mui/material';
import { useMemo, useState } from 'react';
import styles from './environments.module.css';

type EnvironmentsProps = {
  nodeInfo: EnvNodeInfo;
};

const Environments = ({ nodeInfo }: EnvironmentsProps) => {
  const { isReady, envs } = useP2P();

  const [showingMore, setShowingMore] = useState(false);

  /**
   * Show only the first 3 environments
   * Show rest of the environments in a collapsible section
   */
  const [firstEnvs, restEnvs] = useMemo(() => {
    // Only show environments that support chain ID and USDC/COMPY
    const filteredEnvs = envs.filter((env) => {
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
    });
    const firstEnvs = filteredEnvs.slice(0, 3);
    const restEnvs = filteredEnvs.slice(3);
    return [firstEnvs, restEnvs];
  }, [envs]);

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Environments</h3>
      <div className={styles.list}>
        {!isReady ? (
          <div>Fetching data...</div>
        ) : firstEnvs.length ? (
          <>
            {firstEnvs.map((env) => (
              <EnvironmentCard key={env.id} environment={env} nodeInfo={nodeInfo} />
            ))}
            {restEnvs.length ? (
              <>
                {showingMore ? null : (
                  <Button
                    className="alignSelfCenter"
                    color="accent2"
                    onClick={() => setShowingMore(true)}
                    variant="filled"
                  >
                    Show more
                  </Button>
                )}
                <Collapse in={showingMore}>
                  <div className={styles.list}>
                    {restEnvs.map((env) => (
                      <EnvironmentCard key={env.id} environment={env} nodeInfo={nodeInfo} />
                    ))}
                    {showingMore ? (
                      <Button
                        className="alignSelfCenter"
                        color="accent2"
                        onClick={() => setShowingMore(false)}
                        variant="filled"
                      >
                        Show less
                      </Button>
                    ) : null}
                  </div>
                </Collapse>
              </>
            ) : null}
          </>
        ) : (
          <div>No environments</div>
        )}
      </div>
    </Card>
  );
};

export default Environments;
