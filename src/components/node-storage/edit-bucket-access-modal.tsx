'use client';

import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import Modal from '@/components/modal/modal';
import AccessListEditor from '@/components/node-storage/access-list-editor';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { Node } from '@/types/nodes';
import { formatChainLabel } from '@/utils/formatters';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CircularProgress, Collapse } from '@mui/material';
import { PersistentStorageBucket } from '@oceanprotocol/lib';
import { useState } from 'react';
import { toast } from 'react-toastify';
import styles from './edit-bucket-access-modal.module.css';

type EditBucketAccessModalProps = {
  bucket: PersistentStorageBucket;
  currentAccount: string;
  isOpen: boolean;
  node: Node;
  onClose: () => void;
};

type AccessListState = {
  chainId: string;
  contractAddress: string;
  loading: boolean;
  open: boolean;
  saving: boolean;
  wallets: string[];
};

function buildAccessListsStates(bucket: PersistentStorageBucket): Record<string, AccessListState> {
  const accessListStates: Record<string, AccessListState> = {};
  for (const entry of bucket.accessLists) {
    for (const [chainId, addresses] of Object.entries(entry)) {
      for (const contractAddress of addresses) {
        accessListStates[contractAddress] = {
          chainId,
          contractAddress,
          loading: false,
          open: false,
          saving: false,
          wallets: [],
        };
      }
    }
  }
  return accessListStates;
}

const EditBucketAccessModal: React.FC<EditBucketAccessModalProps> = ({
  bucket,
  currentAccount,
  isOpen,
  node,
  onClose,
}) => {
  const { getAccessListAddresses, addToAccessList, removeFromAccessList } = useNodeStorage();

  const nodeId = node.id ?? node.nodeId;
  const friendlyName = node.friendlyName ?? nodeId;

  const [accessListStates, setAccessListStates] = useState<Record<string, AccessListState>>(() =>
    buildAccessListsStates(bucket)
  );

  const updateAccessListState = (contractAddress: string, updates: Partial<AccessListState>) => {
    setAccessListStates((prev) => ({
      ...prev,
      [contractAddress]: { ...prev[contractAddress], ...updates },
    }));
  };

  async function toggleSection(contractAddress: string) {
    const accessListState = accessListStates[contractAddress];
    if (accessListState.open) {
      updateAccessListState(contractAddress, { open: false });
      return;
    }
    updateAccessListState(contractAddress, { open: true, loading: true });
    try {
      if (accessListState.wallets.length > 0) {
        updateAccessListState(contractAddress, { loading: false });
      } else {
        const wallets = await getAccessListAddresses(accessListState.contractAddress);
        updateAccessListState(contractAddress, { wallets, loading: false });
      }
    } catch (e: any) {
      updateAccessListState(contractAddress, { loading: false });
      toast.error(e?.message ?? 'Failed to load addresses');
    }
  }

  async function handleAdd(contractAddress: string, wallet: string) {
    const accessListState = accessListStates[contractAddress];
    updateAccessListState(contractAddress, { saving: true });
    try {
      await addToAccessList({ contractAddress, wallet });
      updateAccessListState(contractAddress, { wallets: [...accessListState.wallets, wallet], saving: false });
    } catch (e: any) {
      updateAccessListState(contractAddress, { saving: false });
      toast.error(e?.message ?? 'Failed to add wallet');
    }
  }

  async function handleRemove(contractAddress: string, wallet: string) {
    const accessListState = accessListStates[contractAddress];
    updateAccessListState(contractAddress, { saving: true });
    try {
      await removeFromAccessList({ contractAddress, wallet });
      updateAccessListState(contractAddress, {
        wallets: accessListState.wallets.filter((w) => w !== wallet),
        saving: false,
      });
    } catch (e: any) {
      updateAccessListState(contractAddress, { saving: false });
      toast.error(e?.message ?? 'Failed to remove wallet');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit bucket access" width="md" fullWidth>
      <div className="flexColumn gapMd">
        <div className="flexColumn gapSm">
          <div className={styles.infoRow}>
            <div className="textSecondary">Node:</div>
            {friendlyName ? (
              <div>
                <strong>{friendlyName}</strong>
                <div className="textSecondary">{nodeId}</div>
              </div>
            ) : (
              <div>{nodeId}</div>
            )}
          </div>
          <div className={styles.infoRow}>
            <div className="textSecondary">Bucket:</div>
            <strong>{bucket.bucketId}</strong>
          </div>
        </div>

        <div className="flexColumn gapSm">
          {Object.values(accessListStates).length === 0 && (
            <span className="textSecondary" style={{ fontSize: 14 }}>
              No access lists configured.
            </span>
          )}
          {Object.values(accessListStates).map((accessListState) => (
            <div key={`${accessListState.chainId}-${accessListState.contractAddress}`} className={styles.accessSection}>
              <button
                type="button"
                className={styles.sectionHeader}
                onClick={() => toggleSection(accessListState.contractAddress)}
                aria-expanded={accessListState.open}
              >
                <ExpandMoreIcon
                  className={styles.expandIcon}
                  style={{ transform: accessListState.open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
                <span>
                  Access list <strong>{accessListState.contractAddress}</strong>
                </span>
                <span className="chip chipPrimaryOutlined">{formatChainLabel(accessListState.chainId)}</span>
              </button>
              <Collapse in={accessListState.open}>
                <div className={styles.sectionBody}>
                  {accessListState.loading ? (
                    <div className={styles.loadingRow}>
                      <CircularProgress size={18} />
                      <span className="textSecondary" style={{ fontSize: 13 }}>
                        Loading addresses…
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className={styles.sectionBodyHeader}>
                        <strong>Wallet addresses in this access list:</strong>
                        <CopyButton
                          color="accent1"
                          contentToCopy={accessListState.contractAddress}
                          label="Copy access list address"
                          size="link"
                          variant="transparent"
                        />
                      </div>
                      <AccessListEditor
                        currentAccount={currentAccount}
                        loading={accessListState.saving}
                        onAdd={(wallet) => handleAdd(accessListState.contractAddress, wallet)}
                        onRemove={(wallet) => handleRemove(accessListState.contractAddress, wallet)}
                        wallets={accessListState.wallets}
                      />
                    </>
                  )}
                </div>
              </Collapse>
            </div>
          ))}
        </div>
        <div className="actionsGroupMdEnd">
          <Button color="accent1" variant="outlined" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditBucketAccessModal;
