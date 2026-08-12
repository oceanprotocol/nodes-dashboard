'use client';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import BucketsTable from '@/components/node-storage/buckets-table';
import CreateBucketModal from '@/components/node-storage/create-bucket-modal';
import ListNodeBucketsModal from '@/components/node-storage/list-node-buckets-modal';
import { getApiRoute } from '@/config';
import { useNodeTokensContext } from '@/context/node-tokens';
import { useP2P } from '@/contexts/P2PContext';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { StorageNode } from '@/types/node-storage';
import { formatError } from '@/utils/formatters';
import { peerIdToStorageNode, tokenNodeToStorageNode } from '@/utils/node-storage';
import AddIcon from '@mui/icons-material/Add';
import CachedIcon from '@mui/icons-material/Cached';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { Collapse } from '@mui/material';
import axios from 'axios';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './remote-storage-manager.module.css';

/**
 * Only tokens minted through the run-job flow remember the node's name (generate-token-card), so for
 * every other node the name comes from the node index — the same source run-job reads it from.
 */
const fetchNodeFriendlyName = async (nodeId: string): Promise<string | undefined> => {
  try {
    const response = await axios.get(`${getApiRoute('nodes')}?page=0&size=1&nodeId=${nodeId}`);
    return response.data?.nodes?.[0]?._source?.friendlyName || undefined;
  } catch {
    // A missing name just leaves the peer ID as the node's only label.
    return undefined;
  }
};

/** A dial that lost the race for the P2P connection, as opposed to a node that answered with a refusal. */
const isDialError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /cannot dial peer|no valid multiaddresses|aborted|timeout/i.test(message);
};

const RemoteStorageManager: React.FC = () => {
  const { account } = useOceanAccount();

  const { hasValidNodeToken, nodeTokens } = useNodeTokensContext();
  const { buckets, fetchingBuckets, fetchBuckets } = useNodeStorage();
  // Every bucket call goes over the P2P node, which sets itself up after mount.
  const { isReady: isP2PReady } = useP2P();

  const [addedNodes, setAddedNodes] = useState<StorageNode[]>([]);
  const [createForNode, setCreateForNode] = useState<StorageNode | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lookupOpen, setLookupOpen] = useState(false);
  // Names resolved from the node index, by peer ID.
  const [nodeNames, setNodeNames] = useState<Record<string, string>>({});
  // Sections open themselves once a node has buckets; this only holds the user's explicit choices.
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Nodes already listed in this session, so re-renders don't re-request buckets.
  const listedRef = useRef<Set<string>>(new Set());
  // Nodes already looked up in the index, named or not — one attempt each per session.
  const namedRef = useRef<Set<string>>(new Set());
  const listedAddressRef = useRef<string | undefined>(undefined);

  /** Nodes the user holds a token for, plus the ones they typed in by peer ID. */
  const nodes = useMemo(() => {
    const byNodeId = new Map<string, StorageNode>();
    Object.entries(nodeTokens).forEach(([nodeId, tokens]) => {
      if (tokens?.length) {
        byNodeId.set(nodeId, tokenNodeToStorageNode(nodeId, tokens));
      }
    });
    addedNodes.forEach((node) => {
      if (!byNodeId.has(node.nodeId)) {
        byNodeId.set(node.nodeId, node);
      }
    });
    return Array.from(byNodeId.values());
  }, [addedNodes, nodeTokens]);

  /** Resolves to an error message, or null when the node's buckets arrived. */
  const listBuckets = useCallback(
    async (node: StorageNode): Promise<string | null> => {
      listedRef.current.add(node.nodeId);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[node.nodeId];
        return next;
      });
      try {
        await fetchBuckets({ nodeId: node.nodeId, nodeUri: node.nodeUri });
        return null;
      } catch (firstError: any) {
        // Dials fail transiently — a peer lookup that timed out, a connection dropped between
        // sessions. One retry turns most of those into a normal load instead of a dead panel.
        if (!isDialError(firstError)) {
          const message = formatError({ error: firstError, fallback: 'The buckets could not be loaded.' });
          setErrors((prev) => ({ ...prev, [node.nodeId]: message }));
          return message;
        }
      }
      try {
        await fetchBuckets({ nodeId: node.nodeId, nodeUri: node.nodeUri });
        return null;
      } catch (e: any) {
        const message = formatError({ error: e, fallback: 'The buckets could not be loaded.' });
        setErrors((prev) => ({ ...prev, [node.nodeId]: message }));
        return message;
      }
    },
    [fetchBuckets]
  );

  useEffect(() => {
    if (listedAddressRef.current !== account.address) {
      listedAddressRef.current = account.address;
      listedRef.current = new Set();
      setAddedNodes([]);
      setErrors({});
    }
    // Listing before the P2P node is up fails with "Node not ready", and nothing would retry it —
    // isReady is a dependency, so the pass below runs again the moment the node comes up.
    if (!account.address || !isP2PReady) {
      return;
    }
    // A live token means listing costs no signature, so those nodes load on their own. Nodes with
    // no usable token wait for the user to ask, since minting one opens a signature prompt.
    nodes.forEach((node) => {
      if (listedRef.current.has(node.nodeId) || node.nodeId in buckets) {
        return;
      }
      if (!hasValidNodeToken(node.nodeId)) {
        return;
      }
      listBuckets(node);
    });
  }, [account.address, buckets, hasValidNodeToken, isP2PReady, listBuckets, nodes]);

  useEffect(() => {
    nodes.forEach(async (node) => {
      if (node.friendlyName || namedRef.current.has(node.nodeId)) {
        return;
      }
      namedRef.current.add(node.nodeId);
      const friendlyName = await fetchNodeFriendlyName(node.nodeId);
      if (friendlyName) {
        setNodeNames((prev) => ({ ...prev, [node.nodeId]: friendlyName }));
      }
    });
  }, [nodes]);

  const handleListByPeerId = async (peerId: string) => {
    const node = peerIdToStorageNode(peerId);
    setAddedNodes((prev) => (prev.some((added) => added.nodeId === node.nodeId) ? prev : [...prev, node]));
    setOpenOverrides((prev) => ({ ...prev, [node.nodeId]: true }));
    return listBuckets(node);
  };

  const toggleOpen = (nodeId: string, isOpen: boolean) => {
    setOpenOverrides((prev) => ({ ...prev, [nodeId]: !isOpen }));
  };

  const term = searchTerm.trim().toLowerCase();

  /** The node with its name filled in from the index when its tokens didn't carry one. */
  const withName = (node: StorageNode): StorageNode =>
    node.friendlyName ? node : { ...node, friendlyName: nodeNames[node.nodeId] };

  const matchesNode = (node: StorageNode) =>
    node.nodeId.toLowerCase().includes(term) || (withName(node).friendlyName ?? '').toLowerCase().includes(term);

  const bucketsForNode = (node: StorageNode) => {
    const nodeBuckets = buckets[node.nodeId] ?? [];
    if (!term || matchesNode(node)) {
      return nodeBuckets;
    }
    return nodeBuckets.filter(
      (bucket) => bucket.bucketId.toLowerCase().includes(term) || (bucket.label ?? '').toLowerCase().includes(term)
    );
  };

  const visibleNodes = nodes.filter((node) => !term || matchesNode(node) || bucketsForNode(node).length > 0);
  const totalBuckets = nodes.reduce((total, node) => total + (buckets[node.nodeId]?.length ?? 0), 0);

  return (
    <>
      <CreateBucketModal
        isOpen={createOpen || !!createForNode}
        node={createForNode ?? undefined}
        onClose={() => {
          setCreateOpen(false);
          setCreateForNode(null);
        }}
        onSave={(node) => setOpenOverrides((prev) => ({ ...prev, [node.nodeId]: true }))}
      />
      <ListNodeBucketsModal isOpen={lookupOpen} onClose={() => setLookupOpen(false)} onSubmit={handleListByPeerId} />
      <Card direction="column" padding="md" radius="md" shadow="black" spacing="md" variant="glass-shaded">
        <div className={styles.cardHeader}>
          <h3>Buckets</h3>
          <div className={styles.headerActions}>
            <Button
              color="accent1"
              disabled={!isP2PReady}
              onClick={() => setLookupOpen(true)}
              size="md"
              variant="transparent"
            >
              List from another node
            </Button>
            <Button
              color="accent1"
              contentBefore={<AddIcon />}
              disabled={!isP2PReady}
              onClick={() => setCreateOpen(true)}
              size="md"
            >
              Create bucket
            </Button>
          </div>
        </div>

        {!isP2PReady ? <span className="textSecondary">Connecting to the Ocean network…</span> : null}

        {nodes.length === 0 ? (
          <span className="textSecondary">
            No nodes yet. Use &quot;List from another node&quot; to see the buckets you own on it.
          </span>
        ) : (
          <>
            {totalBuckets > 0 ? (
              <Input
                className="alignSelfStart"
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search buckets or nodes..."
                size="sm"
                startAdornment={<SearchIcon className="textAccent1" />}
                type="text"
                value={searchTerm}
              />
            ) : null}
            {visibleNodes.length === 0 ? (
              <span className="textSecondary">No buckets match &quot;{searchTerm.trim()}&quot;.</span>
            ) : null}
            <div className={styles.listItems}>
              {visibleNodes.map((listedNode) => {
                const node = withName(listedNode);
                const nodeBuckets = bucketsForNode(node);
                const bucketCount = nodeBuckets.length;
                const listed = node.nodeId in buckets;
                const loading = fetchingBuckets[node.nodeId] ?? false;
                const error = errors[node.nodeId];
                const isOpen = openOverrides[node.nodeId] ?? bucketCount > 0;
                return (
                  <div className={styles.nodeSection} key={node.nodeId}>
                    <button
                      aria-expanded={isOpen}
                      className={styles.sectionHeader}
                      onClick={() => toggleOpen(node.nodeId, isOpen)}
                      type="button"
                    >
                      <ExpandMoreIcon
                        className={styles.expandIcon}
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      />
                      <div className={styles.nodeIdentity}>
                        {node.friendlyName && <span className={styles.nodeName}>{node.friendlyName}</span>}
                        <span className={styles.peerId} title={node.nodeId}>
                          {node.nodeId}
                        </span>
                      </div>
                      {loading ? (
                        <span className={classNames('chip chipGlass', styles.bucketCount)}>Loading…</span>
                      ) : error ? (
                        <span className={classNames('chip chipError', styles.bucketCount)}>Unavailable</span>
                      ) : listed ? (
                        <span className={classNames('chip chipPrimaryOutlined', styles.bucketCount)}>
                          {bucketCount} bucket{bucketCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className={classNames('chip chipGlass', styles.bucketCount)}>Not listed</span>
                      )}
                    </button>
                    <Collapse in={isOpen} mountOnEnter>
                      <div className={styles.sectionBody}>
                        {error ? <span className="textErrorDarker">{error}</span> : null}
                        {!listed && !loading ? (
                          <span className="textSecondary">Buckets on this node have not been listed yet.</span>
                        ) : null}
                        {listed || loading ? (
                          <BucketsTable
                            backHref="/account/storage"
                            buckets={nodeBuckets}
                            initialDensity="compact"
                            loading={loading}
                            node={node}
                          />
                        ) : null}
                        <div className="actionsGroupMdEnd">
                          <Button
                            color="accent1"
                            contentBefore={<AddIcon />}
                            disabled={!isP2PReady}
                            onClick={() => setCreateForNode(node)}
                            size="sm"
                            variant="transparent"
                          >
                            Create bucket
                          </Button>
                          <Button
                            autoLoading
                            color="accent1"
                            contentBefore={<CachedIcon />}
                            disabled={!isP2PReady}
                            onClick={() => listBuckets(node)}
                            size="sm"
                            variant="transparent"
                          >
                            {listed ? 'Refresh' : 'List buckets'}
                          </Button>
                        </div>
                      </div>
                    </Collapse>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </>
  );
};

export default RemoteStorageManager;
