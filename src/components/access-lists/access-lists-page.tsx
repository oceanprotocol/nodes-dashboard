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
import { useCallback, useEffect, useState } from 'react';
import styles from './access-lists-page.module.css';

const AccessListsPage: React.FC = () => {
  const { account } = useOceanAccount();
  const { getAccessListOwner, searchAccessListsByMember } = useAccessList();

  const [showCreate, setShowCreate] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [memberLists, setMemberLists] = useState<AccessListDoc[]>([]);
  const [ownerMap, setOwnerMap] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [lookup, setLookup] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshLists = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    if (!account.address) {
      setMemberLists([]);
      setOwnerMap({});
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingLists(true);
      try {
        const lists = await searchAccessListsByMember(account.address!).catch((e) => {
          console.warn('Failed to load access lists', e);
          return [] as AccessListDoc[];
        });
        if (cancelled) return;
        setMemberLists(lists);
        const ownerEntries = await Promise.all(
          lists.map(async (doc) => {
            try {
              const owner = await getAccessListOwner(doc.contractAddress);
              return [
                doc.contractAddress.toLowerCase(),
                owner.toLowerCase() === account.address!.toLowerCase(),
              ] as const;
            } catch {
              return [doc.contractAddress.toLowerCase(), false] as const;
            }
          })
        );
        if (cancelled) return;
        setOwnerMap(Object.fromEntries(ownerEntries));
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [account.address, getAccessListOwner, searchAccessListsByMember, refreshTick]);

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
                <strong>Your access lists</strong>
                {loadingLists ? <CircularProgress size={14} /> : null}
              </div>
              {memberLists.length === 0 && !loadingLists ? (
                <span className={styles.empty}>No access lists found.</span>
              ) : (
                <div className={styles.listItems}>
                  {memberLists.map((doc) => {
                    const isOwner = ownerMap[doc.contractAddress.toLowerCase()] ?? false;
                    return (
                      <button
                        className={classNames(styles.listItem, {
                          [styles.listItemActive]: selected?.toLowerCase() === doc.contractAddress.toLowerCase(),
                        })}
                        key={doc.contractAddress}
                        onClick={() => handleSelect(doc.contractAddress)}
                        type="button"
                      >
                        <span className={styles.listItemAddress}>{formatWalletAddress(doc.contractAddress)}</span>
                        <span className={styles.listItemMeta}>{isOwner ? 'manage' : 'read-only'}</span>
                      </button>
                    );
                  })}
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
