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
} from '@/services/nodeService';
import { OCEAN_BOOTSTRAP_NODES } from '@/shared/consts/bootstrapNodes';
import { ComputeEnvironment } from '@/types/environments';
import { ComputeResourceRequest, ProviderInstance } from '@oceanprotocol/lib';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const BOOTSTRAP_PEER_IDS = new Set(
  OCEAN_BOOTSTRAP_NODES.map((addr) => addr.match(/\/p2p\/(\S+)/)?.[1]).filter(Boolean) as string[]
);

interface P2PContextType {
  clearEnvs: () => void;
  computeLogs: any;
  computeResult: Record<string, any> | Uint8Array | undefined;
  computeStatus: Record<string, any> | null;
  config: Record<string, any>;
  envs: ComputeEnvironment[];
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
    peerId: string;
    signMessage: SignMessageFn;
  }) => Promise<Record<string, any>>;
  getComputeResult: (
    peerId: string,
    jobId: string,
    index: number,
    authToken: string,
    address: string
  ) => Promise<Record<string, any> | Uint8Array>;
  getComputeJobStatus: (peerId: string, jobId: string, address: string) => Promise<Record<string, any>>;
  getEnvs: (peerId: string) => Promise<any>;
  /**
   *
   * This is a request that uses admin signature validation on the ocean-node.
   * If user is `Externally Owned Account (EOA)`, address must be undefined.
   * If user is `Smart Account`, address must be sent.
   */
  getNodeLogs: (args: {
    consumerAddress?: string;
    expiryTimestamp: number;
    peerId: string;
    params: { startTime?: string; endTime?: string; maxLogs?: number; moduleName?: string; level?: string };
    signMessage: SignMessageFn;
  }) => Promise<any>;
  initializeCompute: (
    environment: ComputeEnvironment,
    tokenAddress: string,
    validUntil: number,
    peerId: string,
    address: string,
    resources: ComputeResourceRequest[],
    chainId: number,
    provider: ethers.BrowserProvider | ethers.JsonRpcProvider
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
    peerId: string;
    signMessage: SignMessageFn;
  }) => Promise<void>;
  sendCommand: (peerId: string, command: any) => Promise<any>;
  getPeerMultiaddr: (peerId: string) => Promise<string>;
  streamComputeResult: (
    peerId: string,
    jobId: string,
    index: number,
    authToken: string,
    address: string,
    cancelSignal?: AbortSignal,
    expectedBytes?: number
  ) => AsyncGenerator<Uint8Array>;
}

const P2PContext = createContext<P2PContextType | undefined>(undefined);

export function P2PProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [envs, setEnvs] = useState<ComputeEnvironment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [computeLogs] = useState<any>(undefined);
  const [computeResult, setComputeResult] = useState<Record<string, any> | Uint8Array | undefined>(undefined);
  const [computeStatus, setComputeStatus] = useState<Record<string, any> | null>(null);
  const readyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        console.log('🪄 P2PContext: Initializing libp2p node via ocean.js...');

        await initializeP2P(OCEAN_BOOTSTRAP_NODES);

        if (!mounted) return;

        console.log('🔍 P2PContext: P2P started, waiting for bootstrap peer discovery...');

        readyPollRef.current = setInterval(() => {
          if (!mounted) return;
          const discovered = ProviderInstance.getDiscoveredNodes();
          const bootstrapConnected = discovered.some((n) => BOOTSTRAP_PEER_IDS.has(n.peerId));
          if (bootstrapConnected) {
            if (readyPollRef.current) clearInterval(readyPollRef.current);
            setIsReady(true);
            console.log('✅ P2PContext: Bootstrap peer discovered — node ready');
          }
        }, 1000);
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
      if (readyPollRef.current) clearInterval(readyPollRef.current);
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
    async (peerId: string, command: any) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return ProviderInstance.fetchConfig(peerId, command);
    },
    [isReady]
  );

  const getEnvs = useCallback(
    async (peerId: string) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      const result = await getNodeEnvs(peerId);
      setEnvs(result as ComputeEnvironment[]);
    },
    [isReady]
  );

  const getComputeResult = useCallback(
    async (peerId: string, jobId: string, index: number, authToken: string, address: string) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }

      const result = await getComputeJobResult(peerId, jobId, index, authToken, address);

      setComputeResult(result);
      return result;
    },
    [isReady]
  );

  const streamComputeResult = useCallback(
    (
      _peerId: string,
      _jobId: string,
      _index: number,
      _authToken: string,
      _address: string,
      _cancelSignal?: AbortSignal,
      _expectedBytes?: number
    ): AsyncGenerator<Uint8Array> => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      throw new Error('Streaming not supported via ocean.js P2P — use getComputeResult instead');
    },
    [isReady]
  );

  const getComputeJobStatus = useCallback(
    async (peerId: string, jobId: string, address: string) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }

      const result = await getComputeStatus(peerId, jobId, address);

      setComputeStatus(result);
      return result;
    },
    [isReady]
  );

  const getNodeLogs = useCallback(
    async ({
      consumerAddress,
      expiryTimestamp,
      peerId,
      params,
      signMessage,
    }: {
      consumerAddress?: string;
      expiryTimestamp: number;
      peerId: string;
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
        peerId,
        params,
        signMessage,
      });
    },
    [isReady]
  );

  const fetchConfig = useCallback(
    async ({
      consumerAddress,
      expiryTimestamp,
      peerId,
      signMessage,
    }: {
      consumerAddress?: string;
      expiryTimestamp: number;
      peerId: string;
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
        peerId,
        signMessage,
      });
      setConfig(result);
      return result;
    },
    [isReady]
  );

  const pushConfig = useCallback(
    async ({
      config,
      consumerAddress,
      expiryTimestamp,
      peerId,
      signMessage,
    }: {
      config: Record<string, any>;
      consumerAddress?: string;
      expiryTimestamp: number;
      peerId: string;
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
        peerId,
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
      peerId: string,
      address: string,
      resources: ComputeResourceRequest[],
      chainId: number,
      provider: ethers.BrowserProvider | ethers.JsonRpcProvider
    ) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      const payload = {
        datasets: [],
        algorithm: { meta: { rawcode: 'rawcode' } },
        environment: environment.id,
        payment: {
          chainId,
          token: tokenAddress,
          resources,
        },
        maxJobDuration: validUntil,
        consumerAddress: address,
        signature: '',
      };
      const data = await initializeComputeFromService(peerId, payload);
      if (data?.status?.httpStatus != null && data.status.httpStatus >= 400) {
        throw new Error(data.status.error ?? 'Initialize compute failed');
      }
      const cost = data.payment.amount;
      const tokenDecimals = await getTokenDecimals(tokenAddress);
      const decimalsNumber = Number(tokenDecimals);
      const denominatedCost = new BigNumber(cost)
        .div(new BigNumber(10).pow(decimalsNumber))
        .decimalPlaces(decimalsNumber)
        .toString();
      return {
        cost: denominatedCost,
        minLockSeconds: data.payment.minLockSeconds,
      };
    },
    [isReady]
  );

  const clearEnvs = useCallback(() => {
    setEnvs([]);
  }, []);

  return (
    <P2PContext.Provider
      value={{
        clearEnvs,
        computeLogs,
        computeResult,
        computeStatus,
        config,
        envs,
        error,
        fetchConfig,
        getComputeResult,
        getComputeJobStatus,
        getEnvs,
        getNodeLogs,
        initializeCompute,
        isReady,
        pushConfig,
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
