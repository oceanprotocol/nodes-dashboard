import { SignMessageFn } from '@/lib/use-ocean-account';
import {
  fetchNodeConfig,
  getComputeJobResult,
  getComputeStatus,
  getNodeEnvs,
  getNodeLogs as getNodeLogsService,
  getNodeReadyState,
  getPeerMultiaddr as getPeerMultiaddrFromService,
  initializeCompute as initializeComputeFromService,
  initializeNode,
  pushNodeConfig,
  sendCommandToPeer,
} from '@/services/nodeService';
import { OCEAN_BOOTSTRAP_NODES } from '@/shared/consts/bootstrapNodes';
import { ComputeEnvironment, MultiaddrsOrPeerId } from '@/types/environments';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ComputeResourceRequest } from '@oceanprotocol/lib';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { Libp2p } from 'libp2p';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface P2PContextType {
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
    multiaddrsOrPeerId: MultiaddrsOrPeerId;
    signMessage: SignMessageFn;
  }) => Promise<Record<string, any>>;
  getComputeResult: (
    multiaddrsOrPeerId: MultiaddrsOrPeerId,
    jobId: string,
    index: number,
    authToken: string,
    address: string
  ) => Promise<Record<string, any> | Uint8Array>;
  getComputeJobStatus: (
    multiaddrsOrPeerId: MultiaddrsOrPeerId,
    jobId: string,
    address: string
  ) => Promise<Record<string, any>>;
  getEnvs: (multiaddrsOrPeerId: MultiaddrsOrPeerId) => Promise<any>;
  /**
   *
   * This is a request that uses admin signature validation on the ocean-node.
   * If user is `Externally Owned Account (EOA)`, address must be undefined.
   * If user is `Smart Account`, address must be sent.
   */
  getNodeLogs: (args: {
    consumerAddress?: string;
    expiryTimestamp: number;
    multiaddrsOrPeerId: MultiaddrsOrPeerId;
    params: { startTime?: string; endTime?: string; maxLogs?: number; moduleName?: string; level?: string };
    signMessage: SignMessageFn;
  }) => Promise<any>;
  initializeCompute: (
    environment: ComputeEnvironment,
    tokenAddress: string,
    validUntil: number,
    multiaddrsOrPeerId: MultiaddrsOrPeerId,
    address: string,
    resources: ComputeResourceRequest[],
    chainId: number,
    provider: ethers.BrowserProvider | ethers.JsonRpcProvider
  ) => Promise<{ cost: string; minLockSeconds: number }>;
  isReady: boolean;
  node: Libp2p | null;
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
    multiaddrsOrPeerId: MultiaddrsOrPeerId;
    signMessage: SignMessageFn;
  }) => Promise<void>;
  sendCommand: (multiaddrsOrPeerId: MultiaddrsOrPeerId, command: any, protocol?: string) => Promise<any>;
  getPeerMultiaddr: (multiaddrsOrPeerId: MultiaddrsOrPeerId) => Promise<string>;
}

const P2PContext = createContext<P2PContextType | undefined>(undefined);

export function P2PProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [envs, setEnvs] = useState<ComputeEnvironment[]>([]);
  const [node, setNode] = useState<Libp2p | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [computeLogs, setComputeLogs] = useState<any>(undefined);
  const [computeResult, setComputeResult] = useState<Record<string, any> | Uint8Array | undefined>(undefined);
  const [computeStatus, setComputeStatus] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        console.log('P2PContext: Initializing libp2p node in background...');

        const nodeInstance = await initializeNode(OCEAN_BOOTSTRAP_NODES);

        if (mounted) {
          setNode(nodeInstance);
          const ready = getNodeReadyState();
          setIsReady(ready);

          if (ready) {
            console.log('P2PContext: Node ready with bootstrap connections');
          } else {
            console.warn('P2PContext: Node started but may have limited connectivity');
          }
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
    async (multiaddrsOrPeerId: MultiaddrsOrPeerId) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      return getPeerMultiaddrFromService(multiaddrsOrPeerId);
    },
    [isReady, node]
  );

  const sendCommand = useCallback(
    async (multiaddrsOrPeerId: MultiaddrsOrPeerId, command: any, protocol?: string) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      return sendCommandToPeer(multiaddrsOrPeerId, command, protocol);
    },
    [isReady, node]
  );

  const getEnvs = useCallback(
    async (multiaddrsOrPeerId: MultiaddrsOrPeerId) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      const result = await getNodeEnvs(multiaddrsOrPeerId);
      setEnvs(result as ComputeEnvironment[]);
    },
    [isReady, node]
  );

  const getComputeResult = useCallback(
    async (
      multiaddrsOrPeerId: MultiaddrsOrPeerId,
      jobId: string,
      index: number,
      authToken: string,
      address: string
    ) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }

      const result = await getComputeJobResult(multiaddrsOrPeerId, jobId, index, authToken, address);

      setComputeResult(result);
      return result;
    },
    [isReady, node]
  );

  const getComputeJobStatus = useCallback(
    async (multiaddrsOrPeerId: MultiaddrsOrPeerId, jobId: string, address: string) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }

      const result = await getComputeStatus(multiaddrsOrPeerId, jobId, address);

      setComputeStatus(result);
      return result;
    },
    [isReady, node]
  );

  const getNodeLogs = useCallback(
    async ({
      consumerAddress,
      expiryTimestamp,
      multiaddrsOrPeerId,
      params,
      signMessage,
    }: {
      consumerAddress?: string;
      expiryTimestamp: number;
      multiaddrsOrPeerId: MultiaddrsOrPeerId;
      params: { startTime?: string; endTime?: string; maxLogs?: number; moduleName?: string; level?: string };
      signMessage: SignMessageFn;
    }) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      if (!consumerAddress) {
        throw new Error('Missing consumer address');
      }
      return getNodeLogsService({
        consumerAddress,
        expiryTimestamp,
        multiaddrsOrPeerId,
        params,
        signMessage,
      });
    },
    [isReady, node]
  );

  const fetchConfig = useCallback(
    async ({
      consumerAddress,
      expiryTimestamp,
      multiaddrsOrPeerId,
      signMessage,
    }: {
      consumerAddress?: string;
      expiryTimestamp: number;
      multiaddrsOrPeerId: MultiaddrsOrPeerId;
      signMessage: SignMessageFn;
    }) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      if (!consumerAddress) {
        throw new Error('Missing consumer address');
      }
      const result = await fetchNodeConfig({
        consumerAddress,
        expiryTimestamp,
        multiaddrsOrPeerId,
        signMessage,
      });
      setConfig(result);
      return result;
    },
    [isReady, node]
  );

  const pushConfig = useCallback(
    async ({
      config,
      consumerAddress,
      expiryTimestamp,
      multiaddrsOrPeerId,
      signMessage,
    }: {
      config: Record<string, any>;
      consumerAddress?: string;
      expiryTimestamp: number;
      multiaddrsOrPeerId: MultiaddrsOrPeerId;
      signMessage: SignMessageFn;
    }) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      if (!consumerAddress) {
        throw new Error('Missing consumer address');
      }
      await pushNodeConfig({
        config,
        consumerAddress,
        expiryTimestamp,
        multiaddrsOrPeerId,
        signMessage,
      });
      setConfig(config);
    },
    [isReady, node]
  );

  const initializeCompute = useCallback(
    async (
      environment: ComputeEnvironment,
      tokenAddress: string,
      validUntil: number,
      multiaddrsOrPeerId: MultiaddrsOrPeerId,
      address: string,
      resources: ComputeResourceRequest[],
      chainId: number,
      provider: ethers.BrowserProvider | ethers.JsonRpcProvider
    ) => {
      if (!isReady || !node) {
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
      const data = await initializeComputeFromService(multiaddrsOrPeerId, payload);
      if (data?.status?.httpStatus != null && data.status.httpStatus >= 400) {
        throw new Error(data.status.error ?? 'Initialize compute failed');
      }
      const cost = data.payment.amount;
      const tokenDecimals = await new ethers.Contract(tokenAddress, ERC20Template.abi, provider).decimals();
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
    [isReady, node]
  );

  return (
    <P2PContext.Provider
      value={{
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
        node,
        pushConfig,
        getPeerMultiaddr,
        sendCommand,
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
