'use client';

import { CHAIN_ID } from '@/constants/chains';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { useAccessList } from '@/lib/use-access-list';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { createAuthToken } from '@/services/nodeService';
import { BucketAccessState } from '@/types/node-storage';
import { rowsToAccessLists } from '@/utils/access-list';
import { PersistentStorageBucket, PersistentStorageFileEntry } from '@oceanprotocol/lib';
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
  fetchBucketFiles: (args: { bucketId: string; nodeUri: NodeUri }) => Promise<void>;
  /** Upload file to a bucket */
  uploadFile: (args: { bucketId: string; nodeUri: NodeUri; file: File }) => Promise<void>;
  /** Delete file from a bucket */
  deleteFile: (args: { bucketId: string; nodeUri: NodeUri; fileName: string }) => Promise<void>;
  /** Create a bucket on a node */
  createBucket: (args: { nodeId: string; nodeUri: NodeUri; access: BucketAccessState }) => Promise<void>;
  /** Get wallet addresses in an access list contract */
  getAccessListAddresses: (contractAddress: string) => Promise<string[]>;
  /** Add a wallet to an access list contract */
  addToAccessList: (args: { contractAddress: string; wallet: string }) => Promise<void>;
  /** Remove a wallet from an access list contract */
  removeFromAccessList: (args: { contractAddress: string; wallet: string }) => Promise<void>;
};

const NodeStorageContext = createContext<NodeStorageContextType | undefined>(undefined);

export function NodeStorageProvider({ children }: { children: ReactNode }) {
  const { account, signMessage } = useOceanAccount();

  const { createNodeBucket, deleteBucketFile, getNodeBuckets, listBucketFiles, uploadBucketFile } = useP2P();

  const { deployNewAccessList, getAccessListAddresses, addWalletToAccessList, removeWalletFromAccessList } =
    useAccessList();

  const [buckets, setBuckets] = useState<Record<string, PersistentStorageBucket[]>>({});
  const [bucketFiles, setBucketFiles] = useState<Record<string, PersistentStorageFileEntry[]>>({});
  const [fetchingBuckets, setFetchingBuckets] = useState<Record<string, boolean>>({});
  const [fetchingFiles, setFetchingFiles] = useState<Record<string, boolean>>({});
  const [uploadingFile, setUploadingFile] = useState<Record<string, boolean>>({});
  const [deletingFile, setDeletingFile] = useState<Record<string, boolean>>({});

  const prevAddress = useRef<string | undefined>(account.address);

  useEffect(() => {
    if (prevAddress.current && !account.address) {
      setBuckets({});
      setBucketFiles({});
    }
    prevAddress.current = account.address;
  }, [account.address]);

  const getToken = useCallback(
    async (nodeUri: NodeUri) => {
      if (!account.address) {
        throw new Error('Wallet not connected');
      }
      const { token } = await createAuthToken({ consumerAddress: account.address, nodeUri, signMessage });
      return token;
    },
    [account.address, signMessage]
  );

  const fetchBuckets = useCallback(
    async ({ nodeId, nodeUri }: { nodeId: string; nodeUri: NodeUri }) => {
      if (!account.address) {
        return;
      }
      setFetchingBuckets((prev) => ({ ...prev, [nodeId]: true }));
      try {
        const token = await getToken(nodeUri);
        const all = await getNodeBuckets({ authToken: token, nodeUri, ownerAddress: account.address });
        const owned = all.filter((b) => b.owner.toLowerCase() === account.address!.toLowerCase());
        setBuckets((prev) => ({ ...prev, [nodeId]: owned }));
      } catch (e) {
        setBuckets((prev) => ({ ...prev, [nodeId]: prev[nodeId] ?? [] }));
        throw e;
      } finally {
        setFetchingBuckets((prev) => ({ ...prev, [nodeId]: false }));
      }
    },
    [account.address, getNodeBuckets, getToken]
  );

  const fetchBucketFiles = useCallback(
    async ({ bucketId, nodeUri }: { bucketId: string; nodeUri: NodeUri }) => {
      setFetchingFiles((prev) => ({ ...prev, [bucketId]: true }));
      try {
        const token = await getToken(nodeUri);
        const files = await listBucketFiles({ authToken: token, bucketId, nodeUri });
        setBucketFiles((prev) => ({ ...prev, [bucketId]: files }));
      } catch (e) {
        setBucketFiles((prev) => ({ ...prev, [bucketId]: prev[bucketId] ?? [] }));
        throw e;
      } finally {
        setFetchingFiles((prev) => ({ ...prev, [bucketId]: false }));
      }
    },
    [getToken, listBucketFiles]
  );

  const uploadFile = useCallback(
    async ({ bucketId, nodeUri, file }: { bucketId: string; nodeUri: NodeUri; file: File }) => {
      setUploadingFile((prev) => ({ ...prev, [bucketId]: true }));
      try {
        const token = await getToken(nodeUri);
        const entry = await uploadBucketFile({ authToken: token, bucketId, file, nodeUri });
        setBucketFiles((prev) => ({
          ...prev,
          [bucketId]: [...(prev[bucketId] ?? []).filter((f) => f.name !== entry.name), entry],
        }));
      } finally {
        setUploadingFile((prev) => ({ ...prev, [bucketId]: false }));
      }
    },
    [getToken, uploadBucketFile]
  );

  const createBucket = useCallback(
    async ({ nodeId, nodeUri, access }: { nodeId: string; nodeUri: NodeUri; access: BucketAccessState }) => {
      if (!account.address) throw new Error('Wallet not connected');
      const accessListAddress =
        access.mode === 'existing'
          ? access.address.trim()
          : await deployNewAccessList({ wallets: access.wallets, owner: account.address });
      const accessLists = rowsToAccessLists([{ chainId: String(CHAIN_ID), address: accessListAddress }]);
      const token = await getToken(nodeUri);
      await createNodeBucket({ accessLists, authToken: token, nodeUri });
      await fetchBuckets({ nodeId, nodeUri });
    },
    [account.address, createNodeBucket, deployNewAccessList, fetchBuckets, getToken]
  );

  const deleteFile = useCallback(
    async ({ bucketId, nodeUri, fileName }: { bucketId: string; nodeUri: NodeUri; fileName: string }) => {
      const key = `${bucketId}:${fileName}`;
      setDeletingFile((prev) => ({ ...prev, [key]: true }));
      try {
        const token = await getToken(nodeUri);
        await deleteBucketFile({ authToken: token, bucketId, fileName, nodeUri });
        setBucketFiles((prev) => ({
          ...prev,
          [bucketId]: (prev[bucketId] ?? []).filter((f) => f.name !== fileName),
        }));
      } finally {
        setDeletingFile((prev) => ({ ...prev, [key]: false }));
      }
    },
    [deleteBucketFile, getToken]
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
