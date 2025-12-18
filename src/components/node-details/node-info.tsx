import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Balance } from '@/components/node-details/balance';
import Eligibility from '@/components/node-details/eligibility';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node, NodeEligibility } from '@/types/nodes';
import { useAuthModal, useSignMessage, useSmartAccountClient } from '@account-kit/react';
import DnsIcon from '@mui/icons-material/Dns';
import LocationPinIcon from '@mui/icons-material/LocationPin';
import PublicIcon from '@mui/icons-material/Public';
import UploadIcon from '@mui/icons-material/Upload';
import { JsonEditor } from 'json-edit-react';
import { useEffect, useState } from 'react';
import Modal from '../modal/modal';
import styles from './node-info.module.css';
import { toast } from 'react-toastify';

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
  const { config, fetchConfig, pushConfig } = useP2P();

  const [fetchingConfig, setFetchingConfig] = useState<boolean>(false);
  const [pushingConfig, setPushingConfig] = useState<boolean>(false);
  const [isEditConfigDialogOpen, setIsEditConfigDialogOpen] = useState<boolean>(false);
  const [editedConfig, setEditedConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (config) {
      setEditedConfig(config);
    }
  }, [config]);

  async function handleFetchConfig() {
    if (!account.isConnected) {
      openAuthModal();
      return;
    }
    if (!ocean || !node?.id) {
      return;
    }
    const timestamp = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
    const signedMessage = await signMessageAsync({
      message: timestamp.toString(),
    });

    setFetchingConfig(true);
    try {
      await fetchConfig(node.id, signedMessage, timestamp, account.address as string);
    } catch (error) {
      console.error('Error fetching node config :', error);
    } finally {
      setFetchingConfig(false);
    }
  }

  async function handlePushConfig(config: Record<string, any>) {
      let success = false
    if (!account.isConnected) {
      openAuthModal();
      return;
    }
    if (!ocean || !node?.id) {
      return;
    }
    const timestamp = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
    const signedMessage = await signMessageAsync({
      message: timestamp.toString(),
    });

    setPushingConfig(true);
    try {
      await pushConfig(node.id, signedMessage, timestamp, config, account.address as string);
      success = true
    } catch (error) {
      console.error('Error pushing node config :', error);
    } finally {
      setPushingConfig(false);
      if (success) {
          toast.success('Successfully pushed new config!')
          setIsEditConfigDialogOpen(false)
      } else {
          toast.error('Failed to push new config')
      }
    }
  }

  function handleOpenEditConfigModal() {
    if (!config || Object.keys(config).length === 0) {
        handleFetchConfig()
    }

    setIsEditConfigDialogOpen(true)
  }

  function handleCloseModal() {
    setIsEditConfigDialogOpen(false);
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
            <Modal isOpen={isEditConfigDialogOpen} onClose={handleCloseModal} size="xl" title="Edit node config">
              <div className={styles.modalContent}>
                {fetchingConfig && (!config || Object.keys(config).length === 0) ? (
                  <div className={styles.fetching}>Fetching config...</div>
                ) : (
                  <div className="flex flex-col" style={{ gap: '24px' }}>
                    <JsonEditor
                      data={editedConfig}
                      onUpdate={({ newData }) => setEditedConfig(newData as Record<string, any>)}
                      collapse={({ value }) => typeof value === 'object' && value !== null && Object.keys(value).length === 0}
                    />
                      <Button
                        autoLoading
                        color="accent1"
                        loading={pushingConfig}
                        onClick={() => handlePushConfig(editedConfig)}
                        variant="filled"
                      >
                        Push config
                      </Button>
                  </div>
                )}
              </div>
            </Modal>
            <Button contentBefore={<UploadIcon />} onClick={handleOpenEditConfigModal} variant="outlined">
              Edit node config
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
