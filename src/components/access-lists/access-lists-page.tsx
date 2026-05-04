'use client';

import AccessListDetail from '@/components/access-lists/access-list-detail';
import CreateAccessListForm from '@/components/access-lists/create-access-list-form';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import Input from '@/components/input/input';
import SectionTitle from '@/components/section-title/section-title';
import { CHAIN_ID } from '@/constants/chains';
import { AccessListDoc, useAccessList } from '@/lib/use-access-list';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatChainLabel, formatWalletAddress } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import classNames from 'classnames';
import { isAddress } from 'ethers';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './access-lists-page.module.css';

const AccessListsPage: React.FC = () => {
  const { account } = useOceanAccount();
  const { getOwnedAccessListsFromFactory, searchAccessListsByMember } = useAccessList();

  const [showCreate, setShowCreate] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [ownedLists, setOwnedLists] = useState<string[]>([]);
  const [memberLists, setMemberLists] = useState<AccessListDoc[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [lookup, setLookup] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const memberOnly = useMemo(() => {
    const ownedSet = new Set(ownedLists.map((a) => a.toLowerCase()));
    return memberLists.filter((d) => !ownedSet.has(d.contractAddress.toLowerCase()));
  }, [memberLists, ownedLists]);

  const refreshLists = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    if (!account.address) {
      setOwnedLists([]);
      setMemberLists([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingLists(true);
      try {
        const [owned, members] = await Promise.all([
          getOwnedAccessListsFromFactory(account.address!).catch((e) => {
            console.warn('Failed to load owned access lists', e);
            return [] as string[];
          }),
          searchAccessListsByMember(account.address!).catch((e) => {
            console.warn('Failed to load member access lists', e);
            return [] as AccessListDoc[];
          }),
        ]);
        if (cancelled) return;
        setOwnedLists(owned);
        setMemberLists(members);
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [account.address, getOwnedAccessListsFromFactory, searchAccessListsByMember, refreshTick]);

  function handleSelect(address: string) {
    setSelected(address);
    setSelectedVersion((v) => v + 1);
  }

  function handleLookup() {
    const trimmed = lookup.trim();
    if (!trimmed) {
      setLookupError('Address required');
      return;
    }
    if (!isAddress(trimmed)) {
      setLookupError('Invalid contract address');
      return;
    }
    setLookupError(null);
    handleSelect(trimmed);
  }

  function handleCreated(address: string) {
    setShowCreate(false);
    handleSelect(address);
    refreshLists();
  }

  if (!account.isConnected) {
    return (
      <Container className="pageRoot">
        <SectionTitle moreReadable title="Access lists" subTitle="Connect your wallet to manage access lists." />
      </Container>
    );
  }

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Access lists"
        subTitle={`Create and manage AccessList contracts on ${formatChainLabel(CHAIN_ID)}.`}
      />
      <div className="pageContentWrapper">
        <div className={styles.layout}>
          <div className={styles.sidebar}>
            <Card direction="column" padding="md" radius="md" spacing="sm" variant="glass">
              <div className={styles.lookupRow}>
                <Input
                  errorText={lookupError ?? undefined}
                  hint="Look up a list by its contract address"
                  label="Access list contract"
                  onChange={(e) => {
                    setLookup(e.target.value);
                    setLookupError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  placeholder="0x..."
                  size="sm"
                  type="text"
                  value={lookup}
                />
                <Button color="accent1" size="md" onClick={handleLookup}>
                  Open
                </Button>
              </div>
              <Button color="accent1" size="md" variant="outlined" onClick={() => setShowCreate((v) => !v)}>
                {showCreate ? 'Cancel create' : 'Create new access list'}
              </Button>
            </Card>

            <Card direction="column" padding="md" radius="md" spacing="sm" variant="glass">
              <div className={styles.listSectionHeader}>
                <strong>Owned by you</strong>
                {loadingLists ? <CircularProgress size={14} /> : null}
              </div>
              {ownedLists.length === 0 && !loadingLists ? (
                <span className={styles.empty}>No owned access lists found.</span>
              ) : (
                <div className={styles.listItems}>
                  {ownedLists.map((address) => (
                    <button
                      className={classNames(styles.listItem, {
                        [styles.listItemActive]: selected?.toLowerCase() === address.toLowerCase(),
                      })}
                      key={address}
                      onClick={() => handleSelect(address)}
                      type="button"
                    >
                      <span className={styles.listItemAddress}>{formatWalletAddress(address)}</span>
                      <span className={styles.listItemMeta}>manage</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card direction="column" padding="md" radius="md" spacing="sm" variant="glass">
              <div className={styles.listSectionHeader}>
                <strong>You are a member of</strong>
                {loadingLists ? <CircularProgress size={14} /> : null}
              </div>
              {memberOnly.length === 0 && !loadingLists ? (
                <span className={styles.empty}>No memberships found.</span>
              ) : (
                <div className={styles.listItems}>
                  {memberOnly.map((doc) => (
                    <button
                      className={classNames(styles.listItem, {
                        [styles.listItemActive]: selected?.toLowerCase() === doc.contractAddress.toLowerCase(),
                      })}
                      key={doc.contractAddress}
                      onClick={() => handleSelect(doc.contractAddress)}
                      type="button"
                    >
                      <span className={styles.listItemAddress}>{formatWalletAddress(doc.contractAddress)}</span>
                      <span className={styles.listItemMeta}>read-only</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className={styles.sidebar}>
            {showCreate ? <CreateAccessListForm onCreated={handleCreated} /> : null}
            {selected ? (
              <AccessListDetail
                contractAddress={selected}
                currentAccount={account.address}
                key={`${selected}:${selectedVersion}`}
                onMembersChanged={refreshLists}
              />
            ) : (
              <Card direction="column" padding="md" radius="md" spacing="sm" variant="glass">
                <span className={styles.empty}>
                  Select an existing access list, look one up by address, or create a new one.
                </span>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
};

export default AccessListsPage;
