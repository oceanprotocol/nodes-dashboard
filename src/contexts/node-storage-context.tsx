'use client';

import { CHAIN_ID } from '@/constants/chains';
import { useNodeTokensContext } from '@/context/node-tokens';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { useAccessList } from '@/lib/use-access-list';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { BucketAccessState } from '@/types/node-storage';
import { rowsToAccessLists } from '@/utils/access-list';
import { formatError } from '@/utils/formatters';
import { PersistentStorageAccessList, PersistentStorageBucket, PersistentStorageFileEntry } from '@oceanprotocol/lib';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

type NodeStorageContextType = {
  /** Buckets by node ID */
  buckets: Record<string, PersistentStorageBucket[]>;
  /** Bucket files by bucket ID */
  bucketFiles: Record<string, PersistentStorageFileEntry[]>;
  /** Fetching buckets by node ID */
  fetchingBuckets: Record<string, boolean>;
  /** Fetching bucket files by bucket ID */
  fetchingFiles: Record<string, boolean>;
  /** Uploading file by bucket ID */
  uploadingFile: Record<string, boolean>;
  /** Deleting file by bucket ID */
  deletingFile: Record<string, boolean>;
  /** Fetch buckets for a node */
  fetchBuckets: (args: { nodeId: string; nodeUri: NodeUri }) => Promise<void>;
  /** Fetch bucket files for a bucket */
  fetchBucketFiles: (args: { bucketId: string; nodeId: string; nodeUri: NodeUri }) => Promise<void>;
  /** Upload file to a bucket */
  uploadFile: (args: { bucketId: string; nodeId: string; nodeUri: NodeUri; file: File }) => Promise<void>;
  /** Delete file from a bucket */
  deleteFile: (args: { bucketId: string; nodeId: string; nodeUri: NodeUri; fileName: string }) => Promise<void>;
  /**
   * Open a download stream for a bucket file. Resolves once the node accepts the request, so an auth
   * or not-found failure surfaces here rather than mid-drain; the caller consumes the returned
   * iterable to get the bytes. The stream holds its slot in the node-call queue until iteration ends,
   * so callers must drain it, `break` out of it, or abort the signal — leaking a half-read stream
   * parks every later node call behind it.
   */
  downloadFile: (args: {
    bucketId: string;
    nodeId: string;
    nodeUri: NodeUri;
    fileName: string;
    /** Byte offset to resume a partial download from. Omit (or 0) to start from the beginning. */
    offset?: number;
    signal?: AbortSignal;
  }) => Promise<AsyncIterable<Uint8Array>>;
  /** Create a bucket on a node. Resolves with the created bucket (so a caller can e.g. auto-select it). */
  createBucket: (args: {
    access: BucketAccessState;
    label?: string;
    nodeId: string;
    nodeUri: NodeUri;
  }) => Promise<{ bucketId: string }>;
  /** Rename a bucket (set its human-readable name) */
  renameBucket: (args: { bucketId: string; label: string | null; nodeId: string; nodeUri: NodeUri }) => Promise<void>;
  /** Get wallet addresses in an access list contract */
  getAccessListAddresses: (contractAddress: string) => Promise<string[]>;
  /** Add a wallet to an access list contract */
  addToAccessList: (args: { contractAddress: string; wallet: string }) => Promise<void>;
  /** Remove a wallet from an access list contract */
  removeFromAccessList: (args: { contractAddress: string; wallet: string }) => Promise<void>;
};

/** Matches MAX_BUCKET_LABEL_LENGTH enforced by the node. */
export const MAX_BUCKET_NAME_LENGTH = 256;

const NodeStorageContext = createContext<NodeStorageContextType | undefined>(undefined);

export function NodeStorageProvider({ children }: { children: ReactNode }) {
  const { account } = useOceanAccount();
  const { withNodeAuth } = useNodeTokensContext();

  const {
    createNodeBucket,
    renameBucket: renameBucketP2P,
    deleteBucketFile,
    downloadBucketFile,
    getNodeBuckets,
    listBucketFiles,
    uploadBucketFile,
  } = useP2P();

  const { deployNewAccessList, getAccessListAddresses, addWalletToAccessList, removeWalletFromAccessList } =
    useAccessList();

  const [buckets, setBuckets] = useState<Record<string, PersistentStorageBucket[]>>({});
  const [bucketFiles, setBucketFiles] = useState<Record<string, PersistentStorageFileEntry[]>>({});
  const [fetchingBuckets, setFetchingBuckets] = useState<Record<string, boolean>>({});
  const [fetchingFiles, setFetchingFiles] = useState<Record<string, boolean>>({});
  const [uploadingFile, setUploadingFile] = useState<Record<string, boolean>>({});
  const [deletingFile, setDeletingFile] = useState<Record<string, boolean>>({});

  const prevAddress = useRef<string | undefined>(account.address);

  /**
   * Every node call dials over the one browser libp2p node. Firing several at once — the
   * account-wide storage view lists a node per stored auth token — makes the dials compete for it
   * and one loses, failing with "Cannot dial peer … Active connections: 1". Reads queue instead, so
   * each dial gets the connection (and its own 10s window) to itself. Keeps concurrent callers from
   * stacking wallet signature prompts too, since token minting happens inside these calls.
   */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const enqueue = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    // Runs on both settle paths: one node being unreachable must not stall the rest of the queue.
    const result = queueRef.current.then(run, run);
    queueRef.current = result.catch(() => undefined);
    return result;
  }, []);

  // Every cache here is owner-scoped (fetchBuckets filters to account.address), so it can't outlive the
  // wallet that filled it — on ANY address change, not just a disconnect. An injected wallet switching
  // accounts goes straight from one address to the next without passing through undefined (see
  // use-injected-wallet's accountsChanged), so a disconnect-only reset would show the new wallet the
  // previous one's buckets.
  useEffect(() => {
    if (prevAddress.current !== account.address) {
      setBuckets({});
      setBucketFiles({});
    }
    prevAddress.current = account.address;
  }, [account.address]);

  const fetchBuckets = useCallback(
    async ({ nodeId, nodeUri }: { nodeId: string; nodeUri: NodeUri }) => {
      if (!account.address) {
        return;
      }
      setFetchingBuckets((prev) => ({ ...prev, [nodeId]: true }));
      try {
        const owned = await enqueue(() =>
          withNodeAuth(nodeId, nodeUri, async (token) => {
            const all = await getNodeBuckets({ authToken: token, nodeUri, ownerAddress: account.address! });
            const filtered = all.filter((b) => b.owner.toLowerCase() === account.address!.toLowerCase());
            return filtered;
          })
        );
        setBuckets((prev) => ({ ...prev, [nodeId]: owned }));
      } catch (e) {
        setBuckets((prev) => ({ ...prev, [nodeId]: prev[nodeId] ?? [] }));
        throw e;
      } finally {
        setFetchingBuckets((prev) => ({ ...prev, [nodeId]: false }));
      }
    },
    [account.address, enqueue, getNodeBuckets, withNodeAuth]
  );

  const fetchBucketFiles = useCallback(
    async ({ bucketId, nodeId, nodeUri }: { bucketId: string; nodeId: string; nodeUri: NodeUri }) => {
      setFetchingFiles((prev) => ({ ...prev, [bucketId]: true }));
      try {
        const files = await enqueue(() =>
          withNodeAuth(nodeId, nodeUri, (token) => listBucketFiles({ authToken: token, bucketId, nodeUri }))
        );
        setBucketFiles((prev) => ({ ...prev, [bucketId]: files }));
      } catch (e) {
        setBucketFiles((prev) => ({ ...prev, [bucketId]: prev[bucketId] ?? [] }));
        throw e;
      } finally {
        setFetchingFiles((prev) => ({ ...prev, [bucketId]: false }));
      }
    },
    [enqueue, withNodeAuth, listBucketFiles]
  );

  const uploadFile = useCallback(
    async ({ bucketId, nodeId, nodeUri, file }: { bucketId: string; nodeId: string; nodeUri: NodeUri; file: File }) => {
      setUploadingFile((prev) => ({ ...prev, [bucketId]: true }));
      try {
        const entry = await enqueue(() =>
          withNodeAuth(nodeId, nodeUri, (token) => uploadBucketFile({ authToken: token, bucketId, file, nodeUri }))
        );
        setBucketFiles((prev) => ({
          ...prev,
          [bucketId]: [...(prev[bucketId] ?? []).filter((f) => f.name !== entry.name), entry],
        }));
      } finally {
        setUploadingFile((prev) => ({ ...prev, [bucketId]: false }));
      }
    },
    [enqueue, withNodeAuth, uploadBucketFile]
  );

  const createBucket = useCallback(
    async ({
      access,
      label,
      nodeId,
      nodeUri,
    }: {
      access: BucketAccessState;
      label?: string;
      nodeId: string;
      nodeUri: NodeUri;
    }): Promise<{ bucketId: string }> => {
      if (!account.address) {
        throw new Error('Wallet not connected');
      }
      let accessLists: PersistentStorageAccessList[];
      switch (access.mode) {
        case 'existing': {
          accessLists = rowsToAccessLists([{ chainId: String(CHAIN_ID), address: access.address.trim() }]);
          break;
        }
        case 'none': {
          accessLists = [];
          break;
        }
        case 'new': {
          const accessListAddress = await deployNewAccessList({
            name: 'BucketAccessList',
            symbol: 'BAL',
            wallets: access.wallets,
            owner: account.address,
          });
          accessLists = rowsToAccessLists([{ chainId: String(CHAIN_ID), address: accessListAddress }]);
          break;
        }
      }
      const bucket = await enqueue(() =>
        withNodeAuth(nodeId, nodeUri, (token) => createNodeBucket({ accessLists, authToken: token, label, nodeUri }))
      );
      // The bucket exists on the node from here on — and for a 'new' access list, a deploy has already
      // been paid for. Refreshing the list is a convenience on top of that, so a failed refetch
      // (fetchBuckets rethrows) must not surface as "your bucket could not be created" and swallow the
      // id the caller needs to select it: report the bucket, leave the stale list to the next fetch.
      try {
        await fetchBuckets({ nodeId, nodeUri });
      } catch (e) {
        console.error('Bucket created, but refreshing the bucket list failed:', e);
      }
      return bucket;
    },
    [account.address, createNodeBucket, deployNewAccessList, enqueue, fetchBuckets, withNodeAuth]
  );

  const renameBucket = useCallback(
    async ({
      bucketId,
      label,
      nodeId,
      nodeUri,
    }: {
      bucketId: string;
      label: string | null;
      nodeId: string;
      nodeUri: NodeUri;
    }) => {
      const result = await enqueue(() =>
        withNodeAuth(nodeId, nodeUri, (token) => renameBucketP2P({ authToken: token, bucketId, label, nodeUri }))
      );
      setBuckets((prev) => ({
        ...prev,
        [nodeId]: (prev[nodeId] ?? []).map((b) => (b.bucketId === bucketId ? { ...b, label: result.label } : b)),
      }));
    },
    [enqueue, renameBucketP2P, withNodeAuth]
  );

  const deleteFile = useCallback(
    async ({
      bucketId,
      nodeId,
      nodeUri,
      fileName,
    }: {
      bucketId: string;
      nodeId: string;
      nodeUri: NodeUri;
      fileName: string;
    }) => {
      const key = `${bucketId}:${fileName}`;
      setDeletingFile((prev) => ({ ...prev, [key]: true }));
      try {
        await enqueue(() =>
          withNodeAuth(nodeId, nodeUri, (token) => deleteBucketFile({ authToken: token, bucketId, fileName, nodeUri }))
        );
        setBucketFiles((prev) => ({
          ...prev,
          [bucketId]: (prev[bucketId] ?? []).filter((f) => f.name !== fileName),
        }));
      } finally {
        setDeletingFile((prev) => ({ ...prev, [key]: false }));
      }
    },
    [deleteBucketFile, enqueue, withNodeAuth]
  );

  const downloadFile = useCallback(
    async ({
      bucketId,
      nodeId,
      nodeUri,
      fileName,
      offset,
      signal,
    }: {
      bucketId: string;
      nodeId: string;
      nodeUri: NodeUri;
      fileName: string;
      /** Byte offset to resume a partial download from. */
      offset?: number;
      signal?: AbortSignal;
    }): Promise<AsyncIterable<Uint8Array>> => {
      // The whole transfer holds the queue slot, not just the request that opens it. The bytes come
      // over the same single libp2p connection every other node call dials on, so releasing the slot
      // once the stream is merely open would put the rest of the queue back into the "Cannot dial
      // peer … Active connections: 1" contention the queue exists to prevent. A large file does park
      // the queue for the length of its transfer — that's the trade, and it's why the slot must be
      // released on EVERY way the stream can end: drained, thrown, or abandoned by the consumer.
      let release!: () => void;
      const drained = new Promise<void>((resolve) => {
        release = resolve;
      });

      // The queued job stays pending until `drained` settles, so the next caller waits for the drain.
      // The stream itself escapes early via `opening`, which is what this function returns.
      let settleOpen!: (stream: AsyncIterable<Uint8Array>) => void;
      let failOpen!: (e: unknown) => void;
      const opening = new Promise<AsyncIterable<Uint8Array>>((resolve, reject) => {
        settleOpen = resolve;
        failOpen = reject;
      });

      void enqueue(async () => {
        let stream: AsyncIterable<Uint8Array>;
        try {
          stream = await withNodeAuth(nodeId, nodeUri, (token) =>
            downloadBucketFile({ authToken: token, bucketId, fileName, nodeUri, offset, signal })
          );
        } catch (e) {
          // Opening failed, so there is nothing to drain: free the slot and surface the error.
          release();
          failOpen(e);
          return;
        }
        settleOpen(stream);
        await drained;
      });

      const stream = await opening;

      // Nothing drains a stream the caller never iterates, so an abort frees the slot too.
      if (signal) {
        if (signal.aborted) {
          release();
        } else {
          signal.addEventListener('abort', () => release(), { once: true });
        }
      }

      // Release the slot the moment iteration ends, however it ends. A consumer's `break`/`return`
      // calls the iterator's return(), and a `throw` inside its loop body calls throw() — both are
      // covered, as is a normal drain and a mid-stream error.
      const iterator = stream[Symbol.asyncIterator]();
      return {
        [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
          return {
            async next() {
              try {
                const result = await iterator.next();
                if (result.done) {
                  release();
                }
                return result;
              } catch (e) {
                release();
                throw e;
              }
            },
            async return(value?: any) {
              try {
                return (await iterator.return?.(value)) ?? { done: true, value };
              } finally {
                release();
              }
            },
            async throw(e?: any) {
              try {
                if (iterator.throw) {
                  return await iterator.throw(e);
                }
                throw e;
              } finally {
                release();
              }
            },
          };
        },
      };
    },
    [downloadBucketFile, enqueue, withNodeAuth]
  );

  return (
    <NodeStorageContext.Provider
      value={{
        buckets,
        bucketFiles,
        fetchingBuckets,
        fetchingFiles,
        uploadingFile,
        deletingFile,
        fetchBuckets,
        fetchBucketFiles,
        uploadFile,
        deleteFile,
        downloadFile,
        createBucket,
        renameBucket,
        getAccessListAddresses: getAccessListAddresses,
        addToAccessList: ({ contractAddress, wallet }) => addWalletToAccessList({ contractAddress, wallet }),
        removeFromAccessList: ({ contractAddress, wallet }) => removeWalletFromAccessList({ contractAddress, wallet }),
      }}
    >
      {children}
    </NodeStorageContext.Provider>
  );
}

export function useNodeStorage() {
  const ctx = useContext(NodeStorageContext);
  if (!ctx) throw new Error('useNodeStorage must be used within NodeStorageProvider');
  return ctx;
}

/**
 * Load a node's persistent-storage buckets once, toasting on failure — shared by every bucket list UI
 * (my-buckets, the template launch picker) so the wallet guard and the "already attempted" tracking
 * can't drift between copies. Skipped while the wallet isn't connected or there's no node yet. The
 * attempt is tracked by wallet + node id (not a plain mount-scoped flag), so switching to a different
 * node — or to a different wallet on the same node — still gets its own load attempt instead of being
 * blocked by the previous one's.
 */
export function useLoadNodeBuckets({ nodeId, nodeUri }: { nodeId: string; nodeUri: NodeUri }) {
  const { account } = useOceanAccount();
  const { buckets, fetchingBuckets, fetchBuckets } = useNodeStorage();
  // Bucket calls go over the P2P node, which sets itself up after mount. Loading before it's up throws
  // "Node not ready" and nothing retries it — and the attempt below would already be spent — so wait
  // for it. isReady is a dependency of the effect, so this runs again once the node comes up.
  const { isReady: isP2PReady } = useP2P();
  // Keyed by wallet AND node: the buckets are the wallet's, so a switch has to re-attempt this node
  // rather than read as "already tried".
  const attemptedRef = useRef<string | null>(null);

  const loadBuckets = useCallback(async () => {
    try {
      await fetchBuckets({ nodeId, nodeUri });
    } catch (e: any) {
      toast.error(formatError({ error: e, fallback: 'The buckets could not be loaded.' }));
    }
  }, [nodeId, nodeUri, fetchBuckets]);

  useEffect(() => {
    if (!account.address || !nodeId || !isP2PReady) {
      return;
    }
    const attempt = `${account.address}|${nodeId}`;
    // `nodeId in buckets` still skips a node another consumer of this hook already loaded — the cache
    // is cleared on a wallet switch, so anything left in it belongs to the current address.
    if (nodeId in buckets || attemptedRef.current === attempt) {
      return;
    }
    attemptedRef.current = attempt;
    loadBuckets();
  }, [account.address, nodeId, buckets, isP2PReady, loadBuckets]);

  return {
    buckets: buckets[nodeId] ?? [],
    /** True once this node's list has landed (success or failure) — vs. still loading for the first time. */
    loaded: nodeId in buckets,
    loading: fetchingBuckets[nodeId] ?? false,
    loadBuckets,
  };
}
