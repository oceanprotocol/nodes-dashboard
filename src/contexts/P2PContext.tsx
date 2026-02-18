import {
  fetchNodeConfig,
  getComputeJobResult,
  getComputeStatus,
  getNodeEnvs,
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
  fetchConfig: (
    multiaddrsOrPeerId: MultiaddrsOrPeerId,
    signature: string,
    expiryTimestamp: number,
    address?: string
  ) => Promise<Record<string, any>>;
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
  pushConfig: (
    multiaddrsOrPeerId: MultiaddrsOrPeerId,
    signature: string,
    expiryTimestamp: number,
    config: Record<string, any>,
    address?: string
  ) => Promise<void>;
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

  const fetchConfig = useCallback(
    async (multiaddrsOrPeerId: MultiaddrsOrPeerId, signature: string, expiryTimestamp: number, address?: string) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      const result = await fetchNodeConfig(multiaddrsOrPeerId, signature, expiryTimestamp, address);
      setConfig(result);
      return result;
    },
    [isReady, node]
  );

  const pushConfig = useCallback(
    async (
      multiaddrsOrPeerId: MultiaddrsOrPeerId,
      signature: string,
      expiryTimestamp: number,
      config: Record<string, any>,
      address?: string
    ) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      await pushNodeConfig(multiaddrsOrPeerId, signature, expiryTimestamp, config, address);
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
