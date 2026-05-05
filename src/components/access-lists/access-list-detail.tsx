'use client';

import Button from '@/components/button/button';
import Input from '@/components/input/input';
import { useAccessList } from '@/lib/use-access-list';
import { formatError } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import classNames from 'classnames';
import { isAddress } from 'ethers';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './access-lists-page.module.css';

type AccessListDetailProps = {
  contractAddress: string;
  currentAccount?: string;
  isOwner: boolean;
  onMembersChanged?: () => void;
};

const AccessListDetail: React.FC<AccessListDetailProps> = ({
  contractAddress,
  currentAccount,
  isOwner,
  onMembersChanged,
}) => {
  const { addWalletToAccessList, getAccessListAddresses, removeWalletFromAccessList } = useAccessList();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [newWallet, setNewWallet] = useState('');
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const memberList = await getAccessListAddresses(contractAddress);
        if (cancelled) return;
        setMembers(memberList);
      } catch (e: any) {
        if (cancelled) return;
        toast.error(formatError({ error: e, fallback: 'Failed to load access list.' }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [contractAddress, getAccessListAddresses]);

  async function handleAdd() {
    const trimmed = newWallet.trim();
    if (!trimmed) return;
    if (!isAddress(trimmed)) {
      setWalletError('Invalid Ethereum address');
      return;
    }
    if (members.some((w) => w.toLowerCase() === trimmed.toLowerCase())) {
      setWalletError('Address already in list');
      return;
    }
    setWalletError(null);
    setSaving(true);
    try {
      await addWalletToAccessList({ contractAddress, wallet: trimmed });
      setMembers((prev) => [...prev, trimmed]);
      setNewWallet('');
      onMembersChanged?.();
    } catch (e: any) {
      toast.error(formatError({ error: e, fallback: 'Failed to add wallet.' }));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(wallet: string) {
    setSaving(true);
    try {
      await removeWalletFromAccessList({ contractAddress, wallet });
      setMembers((prev) => prev.filter((w) => w !== wallet));
      onMembersChanged?.();
    } catch (e: any) {
      toast.error(formatError({ error: e, fallback: 'Failed to remove wallet.' }));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingRow}>
        <CircularProgress size={16} />
        <span className={styles.empty}>Loading members…</span>
      </div>
    );
  }

  return (
    <>
      <strong>Members ({members.length})</strong>
      {members.length === 0 ? (
        <span className={styles.empty}>
          No members yet. The indexer may take a moment to reflect recent on-chain changes.
        </span>
      ) : (
        <div>
          {members.map((wallet) => {
            const isYou = currentAccount && wallet.toLowerCase() === currentAccount.toLowerCase();
            return (
              <div className={styles.memberRow} key={wallet}>
                <span className={styles.memberAddress}>
                  {wallet}
                  {isYou ? <span className={classNames('chip chipPrimaryOutlined')} style={{ marginLeft: 8 }}>you</span> : null}
                </span>
                {isOwner ? (
                  <Button
                    color="accent1"
                    disabled={saving || !!isYou}
                    onClick={() => handleRemove(wallet)}
                    size="link"
                    variant="transparent"
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {isOwner ? (
        <div className={styles.lookupRow}>
          <Input
            disabled={saving}
            errorText={walletError ?? undefined}
            label="Wallet to add"
            onChange={(e) => {
              setNewWallet(e.target.value);
              setWalletError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="0x..."
            size="sm"
            type="text"
            value={newWallet}
          />
          <Button color="accent1" loading={saving} size="md" onClick={handleAdd}>
            Add
          </Button>
        </div>
      ) : null}
    </>
  );
};

export default AccessListDetail;
