'use client';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import { useAccessList } from '@/lib/use-access-list';
import { formatError, formatWalletAddress } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import classNames from 'classnames';
import { isAddress } from 'ethers';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './access-lists-page.module.css';

type AccessListDetailProps = {
  contractAddress: string;
  currentAccount?: string;
  onMembersChanged?: () => void;
};

const AccessListDetail: React.FC<AccessListDetailProps> = ({ contractAddress, currentAccount, onMembersChanged }) => {
  const { addWalletToAccessList, getAccessListAddresses, getAccessListName, getAccessListOwner, removeWalletFromAccessList } =
    useAccessList();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [newWallet, setNewWallet] = useState('');
  const [walletError, setWalletError] = useState<string | null>(null);

  const isOwner = !!currentAccount && !!owner && owner.toLowerCase() === currentAccount.toLowerCase();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [memberList, ownerAddress, listName] = await Promise.all([
          getAccessListAddresses(contractAddress),
          getAccessListOwner(contractAddress).catch(() => null),
          getAccessListName(contractAddress).catch(() => null),
        ]);
        if (cancelled) return;
        setMembers(memberList);
        setOwner(ownerAddress);
        setName(listName);
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
  }, [contractAddress, getAccessListAddresses, getAccessListName, getAccessListOwner]);

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

  return (
    <Card direction="column" padding="md" radius="md" spacing="sm" variant="glass">
      <div className={styles.detailHeader}>
        <strong>{name ?? 'Access list'}</strong>
        <span className={styles.detailAddress}>{contractAddress}</span>
        <div className={styles.detailBadges}>
          {owner ? (
            <span className={classNames('chip', isOwner ? 'chipPrimaryOutlined' : 'chipGlass')}>
              Owner: {isOwner ? 'you' : formatWalletAddress(owner)}
            </span>
          ) : null}
          {!isOwner && owner ? <span className="chip chipGlass">Read-only</span> : null}
        </div>
      </div>
      {loading ? (
        <CircularProgress size={16} />
      ) : (
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
      )}
    </Card>
  );
};

export default AccessListDetail;
