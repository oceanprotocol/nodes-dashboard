import { getTokenDecimals } from '@/lib/token-symbol';
import { SignMessageFn } from '@/lib/use-ocean-account';
import {
  createNodeBucket as createNodeBucketService,
  deleteBucketFile as deleteBucketFileService,
  fetchNodeConfig,
  getComputeJobResult,
  getComputeStatus,
  getNodeBuckets as getNodeBucketsService,
  getNodeEnvs,
  getNodeJobs as getNodeJobsFromService,
  getNodeLogs as getNodeLogsService,
  getPeerMultiaddr as getPeerMultiaddrFromService,
  getServiceLogs as getServiceLogsFromService,
  getServices as getServicesFromService,
  getServiceStatus as getServiceStatusFromService,
  getServiceTemplates as getServiceTemplatesFromService,
  initializeCompute as initializeComputeFromService,
  initializeP2P,
  listBucketFiles as listBucketFilesService,
  normalizeNodeUri,
  pushNodeConfig,
  renameNodeBucket as renameNodeBucketService,
  serviceExtend as serviceExtendFromService,
  serviceRestart as serviceRestartFromService,
  serviceStart as serviceStartFromService,
  serviceStop as serviceStopFromService,
  streamComputeLogs as streamComputeLogsService,
  streamComputeResult as streamComputeResultService,
  streamServiceLogs as streamServiceLogsFromService,
  uploadBucketFile as uploadBucketFileService,
} from '@/services/nodeService';
import { OCEAN_BOOTSTRAP_NODES } from '@/shared/consts/bootstrapNodes';
import { ComputeEnvironment } from '@/types/environments';
import {
  ComputeResourceRequest,
  type NodeComputeJob,
  type NodeLogEntry,
  type NodeLogsParams,
  OceanNode,
  type PersistentStorageAccessList,
  type PersistentStorageBucket,
  type PersistentStorageDeleteFileResponse,
  type PersistentStorageFileEntry,
  ProviderInstance,
  type ServiceJob,
  type ServiceJobListed,
  type ServiceListFilters,
  type ServicePayment,
  type ServiceRestartParams,
  type ServiceStartParams,
  type ServiceTemplatePublic,
  type SignerOrAuthTokenOrSignature,
} from '@oceanprotocol/lib';
import BigNumber from 'bignumber.js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type NodeUri = OceanNode | string[];

interface P2PContextType {
  computeLogs: any;
  computeResult: Record<string, any> | Uint8Array | undefined;
  computeStatus: Record<string, any> | null;
  config: Record<string, any>;
  error: string | null;
  /**
   *
   * This is a request that uses admin signature validation on the ocean-node.
   * If user is `Externally Owned Account (EOA)`, address must be undefined.
   * If user is `Smart Account`, address must be sent.
   */
  fetchConfig: (args: {
    consumerAddress?: string;
    expiryTimestamp: number;
    nodeUri: NodeUri;
    signMessage: SignMessageFn;
  }) => Promise<Record<string, any>>;
  getComputeResult: (
    nodeUri: NodeUri,
    jobId: string,
    index: number,
    authToken: string
  ) => Promise<Record<string, any> | Uint8Array>;
  getComputeJobStatus: (nodeUri: NodeUri, jobId: string, authToken: string) => Promise<Record<string, any>>;
  getEnvs: (nodeUri: NodeUri) => Promise<any>;
  /**
   *
   * This is a request that uses admin signature validation on the ocean-node.
   * If user is `Externally Owned Account (EOA)`, address must be undefined.
   * If user is `Smart Account`, address must be sent.
   */
  getNodeLogs: (args: {
    consumerAddress?: string;
    nodeUri: NodeUri;
    params: NodeLogsParams;
    signMessage: SignMessageFn;
  }) => Promise<NodeLogEntry[]>;
  initializeCompute: (
    environment: ComputeEnvironment,
    tokenAddress: string,
    validUntil: number,
    nodeUri: NodeUri,
    address: string,
    resources: ComputeResourceRequest[],
    chainId: number
  ) => Promise<{ cost: string; minLockSeconds: number }>;
  isReady: boolean;
  /**
   *
   * This is a request that uses admin signature validation on the ocean-node.
   * If user is `Externally Owned Account (EOA)`, address must be undefined.
   * If user is `Smart Account`, address must be sent.
   */
  pushConfig: (args: {
    config: Record<string, any>;
    consumerAddress?: string;
    expiryTimestamp: number;
    nodeUri: NodeUri;
    signMessage: SignMessageFn;
  }) => Promise<void>;
  createNodeBucket: (args: {
    accessLists: PersistentStorageAccessList[];
    authToken: string;
    label?: string;
    nodeUri: NodeUri;
  }) => Promise<{ bucketId: string; owner: string; accessList: PersistentStorageAccessList[]; label?: string | null }>;
  renameBucket: (args: {
    authToken: string;
    bucketId: string;
    label: string | null;
    nodeUri: NodeUri;
  }) => Promise<{ bucketId: string; label: string | null }>;
  getNodeBuckets: (args: {
    authToken: string;
    nodeUri: NodeUri;
    ownerAddress: string;
  }) => Promise<PersistentStorageBucket[]>;
  listBucketFiles: (args: {
    authToken: string;
    bucketId: string;
    nodeUri: NodeUri;
  }) => Promise<PersistentStorageFileEntry[]>;
  uploadBucketFile: (args: {
    authToken: string;
    bucketId: string;
    file: File;
    nodeUri: NodeUri;
  }) => Promise<PersistentStorageFileEntry>;
  deleteBucketFile: (args: {
    authToken: string;
    bucketId: string;
    fileName: string;
    nodeUri: NodeUri;
  }) => Promise<PersistentStorageDeleteFileResponse>;
  getPeerMultiaddr: (peerId: string) => Promise<string>;
  sendCommand: (nodeUri: NodeUri, command: any) => Promise<any>;
  streamComputeResult: (
    nodeUri: NodeUri,
    authToken: string,
    jobId: string,
    index: number
  ) => Promise<AsyncIterable<Uint8Array>>;
  streamComputeLogs: (
    nodeUri: NodeUri,
    authToken: string,
    jobId: string,
    signal?: AbortSignal
  ) => Promise<AsyncIterable<Uint8Array>>;
  /**
   * Start a service-on-demand container (e.g. vLLM inference). Resolves to the created job in
   * `Starting` state — endpoints are empty until it reaches `Running` (poll getServiceStatus).
   * `params.userData` is passed plaintext; ocean.js ECIES-encrypts it before sending.
   */
  serviceStart: (
    nodeUri: NodeUri,
    signerOrAuthToken: SignerOrAuthTokenOrSignature,
    params: ServiceStartParams
  ) => Promise<ServiceJob[]>;
  /** Fetch the caller's service jobs; pass a serviceId to scope to one, omit to list all. `signal` aborts the dial. */
  getServiceStatus: (
    nodeUri: NodeUri,
    signerOrAuthToken: SignerOrAuthTokenOrSignature,
    serviceId?: string,
    signal?: AbortSignal
  ) => Promise<ServiceJob[]>;
  /**
   * List every service running on the node across all owners (node-wide, not owner-scoped like
   * getServiceStatus) — for a node owner to see what's actually running on their hardware. Defaults
   * to services holding a reservation; pass `filters.includeAllStatuses` for every status.
   */
  getServices: (
    nodeUri: NodeUri,
    signerOrAuthToken: SignerOrAuthTokenOrSignature,
    filters?: ServiceListFilters,
    signal?: AbortSignal
  ) => Promise<ServiceJobListed[]>;
  /**
   * List all compute jobs on the node (node-wide, every owner — not scoped to the caller).
   * Unauthenticated. `fromTimestamp` (Unix seconds) optionally bounds to recent jobs.
   */
  getNodeJobs: (nodeUri: NodeUri, fromTimestamp?: number, signal?: AbortSignal) => Promise<NodeComputeJob[]>;
  /** Extend a running service's lifetime by `additionalDuration` seconds (paid like the start). */
  serviceExtend: (
    nodeUri: NodeUri,
    signerOrAuthToken: SignerOrAuthTokenOrSignature,
    serviceId: string,
    additionalDuration: number,
    payment: ServicePayment
  ) => Promise<ServiceJob[]>;
  /** Stop a running service; resolves to the updated job(s) in `Stopped` state. */
  serviceStop: (
    nodeUri: NodeUri,
    signerOrAuthToken: SignerOrAuthTokenOrSignature,
    serviceId: string
  ) => Promise<ServiceJob[]>;
  /**
   * Restart a running service's container in place — same serviceId, host port and expiry (paid
   * runtime is preserved). Pass no `spec` to relaunch the stored container unchanged, or the COMPLETE
   * new spec (image + tag + dockerCmd + userData) to swap the model/launch args without minting a new
   * service — used by Edit to keep port + elapsed time instead of stop+start. A partial spec is
   * rejected by the node; see `serviceRestart` in services/nodeService.
   */
  serviceRestart: (
    nodeUri: NodeUri,
    signerOrAuthToken: SignerOrAuthTokenOrSignature,
    serviceId: string,
    spec?: ServiceRestartParams
  ) => Promise<ServiceJob[]>;
  /**
   * Fetch a node's advertised service templates (image + launch command + resource requirements),
   * scoped to `chainId`. Seeds the quick-start packages on the default-models page.
   */
  getServiceTemplates: (nodeUri: NodeUri, chainId?: number, signal?: AbortSignal) => Promise<ServiceTemplatePublic[]>;
  /** Fetch the service container's logs (stdout/stderr) — includes the crash reason on exit. */
  getServiceLogs: (
    nodeUri: NodeUri,
    signerOrAuthToken: SignerOrAuthTokenOrSignature,
    serviceId: string
  ) => Promise<string>;
  /** Live-tail the service container's logs — yields raw Docker-muxed byte chunks until aborted. */
  streamServiceLogs: (
    nodeUri: NodeUri,
    signerOrAuthToken: SignerOrAuthTokenOrSignature,
    serviceId: string,
    signal?: AbortSignal,
    since?: string
  ) => AsyncGenerator<Uint8Array>;
}

const P2PContext = createContext<P2PContextType | undefined>(undefined);

export function P2PProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [computeLogs] = useState<any>(undefined);
  const [computeResult, setComputeResult] = useState<Record<string, any> | Uint8Array | undefined>(undefined);
  const [computeStatus, setComputeStatus] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initializeP2P(OCEAN_BOOTSTRAP_NODES);
        if (mounted) {
          setIsReady(true);
        }
      } catch (err: any) {
        console.error('P2PContext: Failed to initialize node:', err);
        if (mounted) {
          setError(err.message);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const getPeerMultiaddr = useCallback(
    async (peerId: string) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return getPeerMultiaddrFromService(peerId);
    },
    [isReady]
  );

  const sendCommand = useCallback(
    async (nodeUri: NodeUri, command: any) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return ProviderInstance.fetchConfig(normalizeNodeUri(nodeUri), command);
    },
    [isReady]
  );

  const getEnvs = useCallback(
    async (nodeUri: NodeUri) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      const result = await getNodeEnvs(nodeUri);
      return result as ComputeEnvironment[];
    },
    [isReady]
  );

  const getComputeResult = useCallback(
    async (nodeUri: NodeUri, jobId: string, index: number, authToken: string) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }

      const result = await getComputeJobResult(nodeUri, authToken, jobId, index);

      setComputeResult(result);
      return result;
    },
    [isReady]
  );

  const getComputeJobStatus = useCallback(
    async (nodeUri: NodeUri, jobId: string, authToken: string) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }

      const result = await getComputeStatus(nodeUri, authToken, jobId);

      setComputeStatus(result as Record<string, any>);
      return result as Record<string, any>;
    },
    [isReady]
  );

  const getNodeLogs = useCallback(
    async ({
      consumerAddress,
      nodeUri,
      params,
      signMessage,
    }: {
      consumerAddress?: string;
      nodeUri: NodeUri;
      params: NodeLogsParams;
      signMessage: SignMessageFn;
    }) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      if (!consumerAddress) {
        throw new Error('Missing consumer address');
      }
      return getNodeLogsService({
        consumerAddress,
        nodeUri,
        params,
        signMessage,
      });
    },
    [isReady]
  );

  const fetchConfigCtx = useCallback(
    async ({
      consumerAddress,
      expiryTimestamp,
      nodeUri,
      signMessage,
    }: {
      consumerAddress?: string;
      expiryTimestamp: number;
      nodeUri: NodeUri;
      signMessage: SignMessageFn;
    }) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      if (!consumerAddress) {
        throw new Error('Missing consumer address');
      }
      const result = await fetchNodeConfig({
        consumerAddress,
        expiryTimestamp,
        nodeUri,
        signMessage,
      });
      setConfig(result);
      return result;
    },
    [isReady]
  );

  const pushConfigCtx = useCallback(
    async ({
      config,
      consumerAddress,
      expiryTimestamp,
      nodeUri,
      signMessage,
    }: {
      config: Record<string, any>;
      consumerAddress?: string;
      expiryTimestamp: number;
      nodeUri: NodeUri;
      signMessage: SignMessageFn;
    }) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      if (!consumerAddress) {
        throw new Error('Missing consumer address');
      }
      await pushNodeConfig({
        config,
        consumerAddress,
        expiryTimestamp,
        nodeUri,
        signMessage,
      });
      setConfig(config);
    },
    [isReady]
  );

  const initializeCompute = useCallback(
    async (
      environment: ComputeEnvironment,
      tokenAddress: string,
      validUntil: number,
      nodeUri: NodeUri,
      address: string,
      resources: ComputeResourceRequest[],
      chainId: number
    ) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      const data = await initializeComputeFromService(
        nodeUri,
        [],
        { meta: { rawcode: 'rawcode' } },
        environment.id,
        tokenAddress,
        validUntil,
        address,
        resources,
        chainId
      );
      const cost = data.payment!.amount;
      const tokenDecimals = await getTokenDecimals(tokenAddress);
      const decimalsNumber = Number(tokenDecimals);
      const denominatedCost = new BigNumber(cost)
        .div(new BigNumber(10).pow(decimalsNumber))
        .decimalPlaces(decimalsNumber)
        .toString();
      return {
        cost: denominatedCost,
        minLockSeconds: data.payment!.minLockSeconds,
      };
    },
    [isReady]
  );

  const streamComputeResult = useCallback(
    async (nodeUri: NodeUri, authToken: string, jobId: string, index: number) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return streamComputeResultService(nodeUri, authToken, jobId, index);
    },
    [isReady]
  );

  const streamComputeLogs = useCallback(
    async (nodeUri: NodeUri, authToken: string, jobId: string, signal?: AbortSignal) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return streamComputeLogsService(nodeUri, authToken, jobId, signal);
    },
    [isReady]
  );

  const createNodeBucket = useCallback(
    async ({
      accessLists,
      authToken,
      label,
      nodeUri,
    }: {
      accessLists: PersistentStorageAccessList[];
      authToken: string;
      label?: string;
      nodeUri: NodeUri;
    }) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return createNodeBucketService({ accessLists, authToken, label, nodeUri });
    },
    [isReady]
  );

  const renameBucket = useCallback(
    async ({
      authToken,
      bucketId,
      label,
      nodeUri,
    }: {
      authToken: string;
      bucketId: string;
      label: string | null;
      nodeUri: NodeUri;
    }) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return renameNodeBucketService({ authToken, bucketId, label, nodeUri });
    },
    [isReady]
  );

  const getNodeBuckets = useCallback(
    async ({ authToken, nodeUri, ownerAddress }: { authToken: string; nodeUri: NodeUri; ownerAddress: string }) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return getNodeBucketsService({ authToken, nodeUri, ownerAddress });
    },
    [isReady]
  );

  const listBucketFiles = useCallback(
    async ({ authToken, bucketId, nodeUri }: { authToken: string; bucketId: string; nodeUri: NodeUri }) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return listBucketFilesService({ authToken, bucketId, nodeUri });
    },
    [isReady]
  );

  const uploadBucketFile = useCallback(
    async ({
      authToken,
      bucketId,
      file,
      nodeUri,
    }: {
      authToken: string;
      bucketId: string;
      file: File;
      nodeUri: NodeUri;
    }) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return uploadBucketFileService({ authToken, bucketId, file, nodeUri });
    },
    [isReady]
  );

  const deleteBucketFile = useCallback(
    async ({
      nodeUri,
      authToken,
      bucketId,
      fileName,
    }: {
      nodeUri: NodeUri;
      authToken: string;
      bucketId: string;
      fileName: string;
    }) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return deleteBucketFileService({ authToken, bucketId, fileName, nodeUri });
    },
    [isReady]
  );

  const serviceStart = useCallback(
    async (nodeUri: NodeUri, signerOrAuthToken: SignerOrAuthTokenOrSignature, params: ServiceStartParams) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return serviceStartFromService(nodeUri, signerOrAuthToken, params);
    },
    [isReady]
  );

  const getServiceStatus = useCallback(
    async (
      nodeUri: NodeUri,
      signerOrAuthToken: SignerOrAuthTokenOrSignature,
      serviceId?: string,
      signal?: AbortSignal
    ) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return getServiceStatusFromService(nodeUri, signerOrAuthToken, serviceId, signal);
    },
    [isReady]
  );

  const getServices = useCallback(
    async (
      nodeUri: NodeUri,
      signerOrAuthToken: SignerOrAuthTokenOrSignature,
      filters?: ServiceListFilters,
      signal?: AbortSignal
    ) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return getServicesFromService(nodeUri, signerOrAuthToken, filters, signal);
    },
    [isReady]
  );

  const getNodeJobs = useCallback(
    async (nodeUri: NodeUri, fromTimestamp?: number, signal?: AbortSignal) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return getNodeJobsFromService(nodeUri, fromTimestamp, signal);
    },
    [isReady]
  );

  const serviceExtend = useCallback(
    async (
      nodeUri: NodeUri,
      signerOrAuthToken: SignerOrAuthTokenOrSignature,
      serviceId: string,
      additionalDuration: number,
      payment: ServicePayment
    ) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return serviceExtendFromService(nodeUri, signerOrAuthToken, serviceId, additionalDuration, payment);
    },
    [isReady]
  );

  const serviceStop = useCallback(
    async (nodeUri: NodeUri, signerOrAuthToken: SignerOrAuthTokenOrSignature, serviceId: string) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return serviceStopFromService(nodeUri, signerOrAuthToken, serviceId);
    },
    [isReady]
  );

  const serviceRestart = useCallback(
    async (
      nodeUri: NodeUri,
      signerOrAuthToken: SignerOrAuthTokenOrSignature,
      serviceId: string,
      spec?: ServiceRestartParams
    ) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return serviceRestartFromService(nodeUri, signerOrAuthToken, serviceId, spec);
    },
    [isReady]
  );

  const getServiceLogs = useCallback(
    async (nodeUri: NodeUri, signerOrAuthToken: SignerOrAuthTokenOrSignature, serviceId: string) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return getServiceLogsFromService(nodeUri, signerOrAuthToken, serviceId);
    },
    [isReady]
  );

  const getServiceTemplates = useCallback(
    async (nodeUri: NodeUri, chainId?: number, signal?: AbortSignal) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return getServiceTemplatesFromService(nodeUri, chainId, signal);
    },
    [isReady]
  );

  const streamServiceLogs = useCallback(
    (
      nodeUri: NodeUri,
      signerOrAuthToken: SignerOrAuthTokenOrSignature,
      serviceId: string,
      signal?: AbortSignal,
      since?: string
    ) => streamServiceLogsFromService(nodeUri, signerOrAuthToken, serviceId, signal, since),
    []
  );

  return (
    <P2PContext.Provider
      value={{
        computeLogs,
        computeResult,
        computeStatus,
        config,
        createNodeBucket,
        renameBucket,
        deleteBucketFile,
        error,
        fetchConfig: fetchConfigCtx,
        getComputeResult,
        getComputeJobStatus,
        getEnvs,
        getNodeBuckets,
        getNodeLogs,
        initializeCompute,
        isReady,
        listBucketFiles,
        pushConfig: pushConfigCtx,
        getPeerMultiaddr,
        sendCommand,
        serviceStart,
        getServiceStatus,
        getServices,
        getNodeJobs,
        serviceExtend,
        serviceRestart,
        serviceStop,
        getServiceLogs,
        getServiceTemplates,
        streamServiceLogs,
        streamComputeResult,
        streamComputeLogs,
        uploadBucketFile,
      }}
    >
      {children}
    </P2PContext.Provider>
  );
}

export function useP2P() {
  const context = useContext(P2PContext);
  if (!context) {
    throw new Error('useP2P must be used within P2PProvider');
  }
  return context;
}
