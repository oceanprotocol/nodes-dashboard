import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Balance } from '@/components/node-details/balance';
import Eligibility from '@/components/node-details/eligibility';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node, NodeEligibility } from '@/types/nodes';
import { useAuthModal, useSignMessage, useSmartAccountClient } from '@account-kit/react';
import DnsIcon from '@mui/icons-material/Dns';
import DownloadIcon from '@mui/icons-material/Download';
import LocationPinIcon from '@mui/icons-material/LocationPin';
import PublicIcon from '@mui/icons-material/Public';
import UploadIcon from '@mui/icons-material/Upload';
import { useState } from 'react';
import styles from './node-info.module.css';

type NodeInfoProps = {
  node: Node;
};

const NodeInfo = ({ node }: NodeInfoProps) => {
  const { client } = useSmartAccountClient({ type: 'LightAccount' });
  const { signMessageAsync } = useSignMessage({
    client,
  });
  const { openAuthModal } = useAuthModal();
  const { account, ocean } = useOceanAccount();
  const { fetchConfig, pushConfig } = useP2P();

  const [fetchingConfig, setFetchingConfig] = useState<boolean>(false);
  const [pushingConfig, setPushingConfig] = useState<boolean>(false);

  async function handleFetchConfig() {
    if (!account.isConnected) {
      openAuthModal();
      return;
    }
    if (!ocean || !node?.id) {
      return;
    }
    const timestamp = Date.now();
    const signedMessage = await signMessageAsync({
      message: timestamp.toString(),
    });

    setFetchingConfig(true);
    try {
      await fetchConfig(node.id, signedMessage, timestamp);
    } catch (error) {
      console.error('Error fetching node config :', error);
    } finally {
      setFetchingConfig(false);
    }
  }

  async function handlePushConfig(config: Record<string, any>) {
    if (!account.isConnected) {
      openAuthModal();
      return;
    }
    if (!ocean || !node?.id) {
      return;
    }
    const timestamp = Date.now();
    const signedMessage = await signMessageAsync({
      message: timestamp.toString(),
    });

    setPushingConfig(true);
    try {
      await pushConfig(node.id, signedMessage, timestamp, config);
    } catch (error) {
      console.error('Error pushing node config :', error);
    } finally {
      setPushingConfig(false);
    }
  }

  return (
    <Card className={styles.root} padding="md" radius="lg" variant="glass-shaded">
      <div className={styles.infoWrapper}>
        <div className={styles.infoContent}>
          <div>
            <h2 className={styles.title}>{node.friendlyName ?? node.id}</h2>
            <div className={styles.hash}>{node.id}</div>
          </div>
          <div className={styles.grid}>
            <PublicIcon className={styles.icon} />
            <div>{`${node.location?.ip} / ${node.ipAndDns?.dns}`}</div>
            {
              <>
                <DnsIcon className={styles.icon} />
                {node.platform?.osType ? <div>{node.platform?.osType}</div> : <div>Unknown</div>}
              </>
            }

            <LocationPinIcon className={styles.icon} />
            <div>
              {node.location?.city}, {node.location?.country}
            </div>
          </div>
          <div className={styles.buttons}>
            <Button
              contentBefore={<DownloadIcon />}
              onClick={handleFetchConfig}
              loading={fetchingConfig}
              variant="outlined"
            >
              Get node config
            </Button>
            <Button contentBefore={<UploadIcon />} onClick={handlePushConfig} loading={pushingConfig}>
              Set node config
            </Button>
          </div>
        </div>
        <div className={styles.infoFooter}>
          <div>
            <strong>Admins:</strong>
            {node.allowedAdmins?.map((admin) => (
              <div key={admin} className={styles.hash}>
                {admin}
              </div>
            ))}
          </div>
          <div>{node.version && <span>Ocean Node v{node.version}</span>}</div>
        </div>
      </div>
      <div className={styles.statusWrapper}>
        <Eligibility
          eligibility={
            node.eligible
              ? NodeEligibility.ELIGIBLE
              : node.eligibilityCauseStr === 'Banned'
                ? NodeEligibility.BANNED
                : NodeEligibility.NON_ELIGIBLE
          }
          eligibilityCauseStr={node.eligibilityCauseStr}
          banInfo={node.banInfo}
        />
        <Balance peerId={node.id ?? node.nodeId} admins={node.allowedAdmins ?? []} />
      </div>
    </Card>
  );
};

export default NodeInfo;
