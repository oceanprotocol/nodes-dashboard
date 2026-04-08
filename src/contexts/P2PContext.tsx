import { getTokenDecimals } from '@/lib/token-symbol';
import { SignMessageFn } from '@/lib/use-ocean-account';
import {
  fetchNodeConfig,
  getComputeJobResult,
  getComputeStatus,
  getNodeEnvs,
  getNodeLogs as getNodeLogsService,
  getPeerMultiaddr as getPeerMultiaddrFromService,
  initializeCompute as initializeComputeFromService,
  initializeP2P,
  pushNodeConfig,
  streamComputeResult as streamComputeResultService,
} from '@/services/nodeService';
import { OCEAN_BOOTSTRAP_NODES } from '@/shared/consts/bootstrapNodes';
import { ComputeEnvironment, MultiaddrsOrPeerId } from '@/types/environments';
import { multiaddr } from '@multiformats/multiaddr';
import { ComputeResourceRequest, ProviderInstance } from '@oceanprotocol/lib';
import BigNumber from 'bignumber.js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type NodeUri = string[] | string;

function toNodeUri(input: NodeUri) {
  if (Array.isArray(input)) return input.map((a) => multiaddr(a));
  return input;
}

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
    expiryTimestamp: number;
    nodeUri: NodeUri;
    params: { startTime?: string; endTime?: string; maxLogs?: number; moduleName?: string; level?: string };
    signMessage: SignMessageFn;
  }) => Promise<any>;
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
  getPeerMultiaddr: (peerId: string) => Promise<string>;
  sendCommand: (nodeUri: NodeUri, command: any) => Promise<any>;
  streamComputeResult: (nodeUri: NodeUri, authToken: string, jobId: string, index: number) => Promise<AsyncIterable<Uint8Array>>;
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
      return ProviderInstance.fetchConfig(toNodeUri(nodeUri), command);
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
      expiryTimestamp,
      nodeUri,
      params,
      signMessage,
    }: {
      consumerAddress?: string;
      expiryTimestamp: number;
      nodeUri: NodeUri;
      params: { startTime?: string; endTime?: string; maxLogs?: number; moduleName?: string; level?: string };
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
        expiryTimestamp,
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

  return (
    <P2PContext.Provider
      value={{
        computeLogs,
        computeResult,
        computeStatus,
        config,
        error,
        fetchConfig: fetchConfigCtx,
        getComputeResult,
        getComputeJobStatus,
        getEnvs,
        getNodeLogs,
        initializeCompute,
        isReady,
        pushConfig: pushConfigCtx,
        getPeerMultiaddr,
        sendCommand,
        streamComputeResult,
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
