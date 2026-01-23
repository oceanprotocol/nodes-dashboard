import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Balance } from '@/components/node-details/balance';
import Eligibility from '@/components/node-details/eligibility';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { sendCommandToPeer } from '@/services/nodeService';
import { Node, NodeEligibility } from '@/types/nodes';
import { useAuthModal } from '@account-kit/react';
import DnsIcon from '@mui/icons-material/Dns';
import LocationPinIcon from '@mui/icons-material/LocationPin';
import PublicIcon from '@mui/icons-material/Public';
import UploadIcon from '@mui/icons-material/Upload';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import ConfigModal from './config-modal';
import styles from './node-info.module.css';

type NodeInfoProps = {
  node: Node;
};

const NodeInfo = ({ node }: NodeInfoProps) => {
  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();

  const { account, ocean, signMessage } = useOceanAccount();
  const { config, fetchConfig, pushConfig, isReady } = useP2P();

  const [fetchingConfig, setFetchingConfig] = useState<boolean>(false);
  const [pushingConfig, setPushingConfig] = useState<boolean>(false);
  const [isEditConfigDialogOpen, setIsEditConfigDialogOpen] = useState<boolean>(false);
  const [editedConfig, setEditedConfig] = useState<Record<string, any>>({});
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // TODO: replace this
  // This is temporary, used for local testing because `node` from props was
  // naked, as it was a local node and the request is made to elastic.
  // In the final solution the isAdmin with useMemo from below should be used.
  const getNodeStatus = useCallback(
    async (peerId: string) => {
      const res = await sendCommandToPeer(peerId, { command: 'status' });
      const isInAllowedAdmins = res.allowedAdmins?.addresses.includes(account?.address as string);
      node.allowedAdmins = res.allowedAdmins;
      setIsAdmin(!!isInAllowedAdmins);
    },
    [account?.address]
  );

  useEffect(() => {
    if (isReady && node.id) {
      getNodeStatus(node.id);
    }
  }, [isReady, node?.id, getNodeStatus]);

  //const isAdmin = useMemo(
  //  () => node.allowedAdmins?.addresses.includes(account?.address as string),
  //  [node.allowedAdmins, account]
  //);

  // This is a workaround for the modal not closing after connecting
  // https://github.com/alchemyplatform/aa-sdk/issues/2327
  // TODO remove once the issue is fixed
  useEffect(() => {
    if (isAuthModalOpen && account.isConnected) {
      closeAuthModal();
    }
  }, [account.isConnected, closeAuthModal, isAuthModalOpen]);

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
    setFetchingConfig(true);
    try {
      const timestamp = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
      const signedMessage = await signMessage(timestamp.toString());
      const addressToSend = account.isWallet ? undefined : account.address;
      await fetchConfig(node.id, signedMessage, timestamp, addressToSend);
    } catch (error) {
      console.error('Error fetching node config :', error);
    } finally {
      setFetchingConfig(false);
    }
  }

  async function handlePushConfig(config: Record<string, any>) {
    let success = false;
    if (!account.isConnected) {
      openAuthModal();
      return;
    }
    if (!ocean || !node?.id) {
      return;
    }
    setPushingConfig(true);
    try {
      const timestamp = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
      const signedMessage = await signMessage(timestamp.toString());
      const addressToSend = account.isWallet ? undefined : account.address;
      await pushConfig(node.id, signedMessage, timestamp, config, addressToSend);
      success = true;
    } catch (error) {
      console.error('Error pushing node config :', error);
    } finally {
      setPushingConfig(false);
      if (success) {
        toast.success('Successfully pushed new config!');
        setIsEditConfigDialogOpen(false);
      } else {
        toast.error('Failed to push new config');
      }
    }
  }

  function handleOpenEditConfigModal() {
    if (!config || Object.keys(config).length === 0) {
      handleFetchConfig();
    }

    setIsEditConfigDialogOpen(true);
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
          {isAdmin ? (
            <div className={styles.buttons}>
              <ConfigModal
                isOpen={isEditConfigDialogOpen}
                fetchingConfig={fetchingConfig}
                pushingConfig={pushingConfig}
                config={config}
                editedConfig={editedConfig}
                setEditedConfig={setEditedConfig}
                handlePushConfig={handlePushConfig}
                onClose={handleCloseModal}
              />
              <Button contentBefore={<UploadIcon />} onClick={handleOpenEditConfigModal} variant="outlined">
                Edit node config
              </Button>
            </div>
          ) : null}
        </div>
        <div className={styles.infoFooter}>
          <div>
            <strong>Admins:</strong>
            {node.allowedAdmins?.addresses.map((admin) => (
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
        <Balance admins={node.allowedAdmins?.addresses ?? []} />
      </div>
    </Card>
  );
};

export default NodeInfo;
