'use client';

import { CHAIN_ID } from '@/constants/chains';
import { useNodeTokensContext } from '@/context/node-tokens';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { useAccessList } from '@/lib/use-access-list';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { BucketAccessState } from '@/types/node-storage';
import { rowsToAccessLists } from '@/utils/access-list';
import { PersistentStorageAccessList, PersistentStorageBucket, PersistentStorageFileEntry } from '@oceanprotocol/lib';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

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
  /** Create a bucket on a node */
  createBucket: (args: {
    access: BucketAccessState;
    label?: string;
    nodeId: string;
    nodeUri: NodeUri;
  }) => Promise<void>;
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

  useEffect(() => {
    if (prevAddress.current && !account.address) {
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
        const entry = await withNodeAuth(nodeId, nodeUri, (token) =>
          uploadBucketFile({ authToken: token, bucketId, file, nodeUri })
        );
        setBucketFiles((prev) => ({
          ...prev,
          [bucketId]: [...(prev[bucketId] ?? []).filter((f) => f.name !== entry.name), entry],
        }));
      } finally {
        setUploadingFile((prev) => ({ ...prev, [bucketId]: false }));
      }
    },
    [withNodeAuth, uploadBucketFile]
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
    }) => {
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
      await enqueue(() =>
        withNodeAuth(nodeId, nodeUri, (token) => createNodeBucket({ accessLists, authToken: token, label, nodeUri }))
      );
      await fetchBuckets({ nodeId, nodeUri });
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
