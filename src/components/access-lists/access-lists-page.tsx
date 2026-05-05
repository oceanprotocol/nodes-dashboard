'use client';

import AccessListDetail from '@/components/access-lists/access-list-detail';
import CreateAccessListForm from '@/components/access-lists/create-access-list-form';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import Modal from '@/components/modal/modal';
import SectionTitle from '@/components/section-title/section-title';
import TabBar from '@/components/tab-bar/tab-bar';
import { CHAIN_ID } from '@/constants/chains';
import { AccessListDoc, useAccessList } from '@/lib/use-access-list';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatChainLabel } from '@/utils/formatters';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CircularProgress, Collapse } from '@mui/material';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './access-lists-page.module.css';

type TabKey = 'owned' | 'shared';

const AccessListsPage: React.FC = () => {
  const { account } = useOceanAccount();
  const { getAccessListOwner, searchAccessListsByMember } = useAccessList();

  const [activeTab, setActiveTab] = useState<TabKey>('owned');
  const [showCreate, setShowCreate] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [memberLists, setMemberLists] = useState<AccessListDoc[]>([]);
  const [ownerMap, setOwnerMap] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  const { ownedLists, sharedLists } = useMemo(() => {
    const owned: AccessListDoc[] = [];
    const shared: AccessListDoc[] = [];
    for (const doc of memberLists) {
      if (ownerMap[doc.contractAddress.toLowerCase()]) owned.push(doc);
      else shared.push(doc);
    }
    return { ownedLists: owned, sharedLists: shared };
  }, [memberLists, ownerMap]);

  const visibleLists = activeTab === 'owned' ? ownedLists : sharedLists;

  function toggleExpanded(address: string) {
    const key = address.toLowerCase();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleCreated(address: string) {
    setShowCreate(false);
    setActiveTab('owned');
    setExpanded((prev) => new Set(prev).add(address.toLowerCase()));
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
        <TabBar
          activeKey={activeTab}
          className={styles.tabBar}
          tabs={[
            { key: 'owned', label: 'Owned', onClick: () => setActiveTab('owned') },
            { key: 'shared', label: 'Shared with me', onClick: () => setActiveTab('shared') },
          ]}
        />

        <Card direction="column" padding="md" radius="md" spacing="sm" variant="glass">
          <div className={styles.listSectionHeader}>
            <strong>
              {activeTab === 'owned' ? 'Access lists you own' : 'Access lists shared with you'}
            </strong>
            <div className={styles.headerActions}>
              {loadingLists ? <CircularProgress size={14} /> : null}
              {activeTab === 'owned' ? (
                <Button color="accent1" size="md" onClick={() => setShowCreate(true)}>
                  Create new access list
                </Button>
              ) : null}
            </div>
          </div>

          {visibleLists.length === 0 && !loadingLists ? (
            <span className={styles.empty}>
              {activeTab === 'owned'
                ? 'You do not own any access lists yet.'
                : 'No access lists have been shared with you.'}
            </span>
          ) : (
            <div className={styles.listItems}>
              {visibleLists.map((doc) => {
                const isOwner = ownerMap[doc.contractAddress.toLowerCase()] ?? false;
                const isOpen = expanded.has(doc.contractAddress.toLowerCase());
                return (
                  <div className={styles.accessSection} key={doc.contractAddress}>
                    <button
                      aria-expanded={isOpen}
                      className={styles.sectionHeader}
                      onClick={() => toggleExpanded(doc.contractAddress)}
                      type="button"
                    >
                      <ExpandMoreIcon
                        className={styles.expandIcon}
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      />
                      <span className={styles.sectionHeaderAddress}>{doc.contractAddress}</span>
                      <span className={classNames('chip', isOwner ? 'chipPrimaryOutlined' : 'chipGlass')}>
                        {isOwner ? 'Owner' : 'Read-only'}
                      </span>
                    </button>
                    <Collapse in={isOpen} mountOnEnter>
                      <div className={styles.sectionBody}>
                        <AccessListDetail
                          contractAddress={doc.contractAddress}
                          currentAccount={account.address}
                          isOwner={isOwner}
                          onMembersChanged={refreshLists}
                        />
                      </div>
                    </Collapse>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create new access list" width="sm" fullWidth>
        <CreateAccessListForm onCreated={handleCreated} />
      </Modal>
    </Container>
  );
};

export default AccessListsPage;
