import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import { CHAIN_ID } from '@/constants/chains';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment, EnvResourcesSelection } from '@/types/environments';
import { Ide } from '@/types/ide';
import { useSignMessage, useSmartAccountClient } from '@account-kit/react';
import classNames from 'classnames';
import { useState } from 'react';
import { toast } from 'react-toastify';
import styles from './summary.module.css';

type SummaryProps = {
  estimatedTotalCost: number;
  selectedEnv: ComputeEnvironment;
  selectedResources: EnvResourcesSelection;
  tokenAddress: string;
};

const Summary = ({ estimatedTotalCost, selectedEnv, selectedResources, tokenAddress }: SummaryProps) => {
  const { client } = useSmartAccountClient({ type: 'LightAccount' });
  const { signMessageAsync } = useSignMessage({
    client,
  });

  const { account, ocean } = useOceanAccount();

  const { gpus } = useEnvResources(selectedEnv);

  const [authToken, setAuthToken] = useState<string | null>(null);

  const feeTokenAddress = selectedEnv.fees?.[CHAIN_ID]?.[0]?.feeToken;

  const generateToken = async () => {
    if (!account.address || !ocean) {
      return;
    }
    try {
      const nonce = await ocean.getNonce(account.address, selectedEnv.nodeId);
      const incrementedNonce = nonce + 1;
      const signedMessage = await signMessageAsync({
        message: account.address + incrementedNonce,
      });
      const token = await ocean.generateAuthToken(account.address, incrementedNonce, signedMessage, selectedEnv.nodeId);
      setAuthToken(token);
    } catch (error) {
      console.error('Failed to generate auth token:', error);
      toast.error('Failed to generate auth token');
    }
  };

  const openIde = async (ide: Ide) => {
    if (!authToken || !account.address || !ocean) {
      return;
    }
    const resources = [
      {
        id: selectedResources.cpuId,
        amount: selectedResources.cpuCores,
      },
      {
        id: selectedResources.ramId,
        amount: selectedResources.ram,
      },
      {
        id: selectedResources.diskId,
        amount: selectedResources.diskSpace,
      },
      ...gpus.map((availableGpu) => ({
        id: availableGpu.id,
        amount: selectedResources.gpus.find((selectedGpu) => selectedGpu.id === availableGpu.id) ? 1 : 0,
      })),
    ];
    const isFreeCompute = estimatedTotalCost === 0;
    ocean.updateConfiguration(
      authToken,
      account.address,
      selectedEnv.nodeId,
      isFreeCompute,
      selectedEnv.id,
      tokenAddress,
      selectedResources.maxJobDurationHours / 60 / 60,
      resources,
      ide
    );
  };

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
        <div className={styles.label}>Total cost:</div>
        <div className={styles.value}>{estimatedTotalCost} USDC</div>
      </div>
      {authToken ? (
        <div className={styles.footer}>
          <div>Continue on our VSCode extension, or select your editor of choice</div>
          <div className={styles.buttons}>
            <Button color="accent2" size="lg" variant="outlined">
              Choose editor
            </Button>
            <Button autoLoading color="accent2" onClick={() => openIde(Ide.VSCODE)} size="lg">
              Open VSCode
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.footer}>
          <div>Continue on our VSCode extension, or select your editor of choice</div>
          <div className={styles.buttons}>
            <Button autoLoading color="accent2" onClick={generateToken} size="lg">
              Generate token
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default Summary;
