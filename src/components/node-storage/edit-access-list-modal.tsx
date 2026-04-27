'use client';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import AccessListEditor from '@/components/node-storage/access-list-editor';
import { CHAIN_ID } from '@/constants/chains';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { formatChainLabel } from '@/utils/formatters';
import { Collapse } from '@mui/material';
import { isAddress } from 'ethers';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { TransitionGroup } from 'react-transition-group';
import styles from './edit-access-list-modal.module.css';

type EditAccessListModalProps = {
  currentAccount?: string;
  isOpen: boolean;
  onClose: () => void;
};

const EditAccessListModalInner: React.FC<EditAccessListModalProps> = ({ currentAccount, onClose }) => {
  const { getAccessListAddresses, addToAccessList, removeFromAccessList } = useNodeStorage();

  const [contractAddress, setContractAddress] = useState('');
  const [contractAddressError, setContractAddressError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  async function handleEdit() {
    const trimmed = contractAddress.trim();
    if (!trimmed) {
      setContractAddressError('Address required');
      return;
    }
    if (!isAddress(trimmed)) {
      setContractAddressError('Invalid contract address');
      return;
    }
    setContractAddressError(null);
    setLoading(true);
    try {
      const result = await getAccessListAddresses(trimmed);
      setWallets(result);
      setEditing(true);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load access list');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(wallet: string) {
    setSaving(true);
    try {
      await addToAccessList({ contractAddress: contractAddress.trim(), wallet });
      setWallets((prev) => [...prev, wallet]);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add wallet');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(wallet: string) {
    setSaving(true);
    try {
      await removeFromAccessList({ contractAddress: contractAddress.trim(), wallet });
      setWallets((prev) => prev.filter((w) => w !== wallet));
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to remove wallet');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flexColumn gapMd">
        <div className={styles.searchRow}>
          <Input
            disabled={editing || loading}
            errorText={contractAddressError ?? undefined}
            hint={`Chain: ${formatChainLabel(CHAIN_ID)}`}
            label="Access list contract address"
            onChange={(e) => {
              setContractAddress(e.target.value);
              setContractAddressError(null);
            }}
            onKeyDown={(e) => !editing && e.key === 'Enter' && handleEdit()}
            placeholder="0x contract address..."
            size="sm"
            type="text"
            value={contractAddress}
          />
          {editing ? (
            <Button
              color="accent1"
              size="md"
              variant="outlined"
              onClick={() => {
                setEditing(false);
                setWallets([]);
              }}
            >
              Edit another
            </Button>
          ) : (
            <Button color="accent1" loading={loading} size="md" onClick={handleEdit}>
              Edit
            </Button>
          )}
        </div>
        <TransitionGroup>
          {editing ? (
            <Collapse>
              <Card direction="column" innerShadow="black" padding="sm" radius="sm" spacing="sm" variant="glass">
                <strong>Wallet addresses in this access list:</strong>
                <AccessListEditor
                  currentAccount={currentAccount}
                  loading={saving}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  wallets={wallets}
                />
              </Card>
            </Collapse>
          ) : null}
        </TransitionGroup>
        <div className="actionsGroupMdEnd">
          <Button color="accent1" variant="outlined" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  );
};

const EditAccessListModal: React.FC<EditAccessListModalProps> = ({ currentAccount, isOpen, onClose }) => {
  return (
    <Modal fullWidth isOpen={isOpen} onClose={onClose} title="Edit access list" width="md">
      <EditAccessListModalInner currentAccount={currentAccount} isOpen={isOpen} onClose={onClose} />
    </Modal>
  );
};

export default EditAccessListModal;
