import {
  fetchNodeConfig,
  getComputeJobResult,
  getNodeEnvs,
  getNodeReadyState,
  initializeNode,
  pushNodeConfig,
  sendCommandToPeer,
} from '@/services/nodeService';
import { OCEAN_BOOTSTRAP_NODES } from '@/shared/consts/bootstrapNodes';
import { ComputeEnvironment } from '@/types/environments';
import { Libp2p } from 'libp2p';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface P2PContextType {
  computeLogs: any;
  computeResult: Record<string, any> | Uint8Array | undefined;
  config: Record<string, any>;
  envs: ComputeEnvironment[];
  error: string | null;
  fetchConfig: (
    peerId: string,
    signature: string,
    expiryTimestamp: number,
    address: string
  ) => Promise<Record<string, any>>;
  getComputeResult: (
    peerId: string,
    jobId: string,
    index: number,
    authToken: string,
    address: string
  ) => Promise<Record<string, any> | Uint8Array>;
  getEnvs: (peerId: string) => Promise<any>;
  isReady: boolean;
  node: Libp2p | null;
  pushConfig: (
    peerId: string,
    signature: string,
    expiryTimestamp: number,
    config: Record<string, any>,
    address: string
  ) => Promise<void>;
  sendCommand: (peerId: string, command: any, protocol?: string) => Promise<any>;
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

  const sendCommand = useCallback(
    async (peerId: string, command: any, protocol?: string) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      return sendCommandToPeer(peerId, command, protocol);
    },
    [isReady, node]
  );

  const getEnvs = useCallback(
    async (peerId: string) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      const result = await getNodeEnvs(peerId);
      setEnvs(result as ComputeEnvironment[]);
    },
    [isReady, node]
  );

  const getComputeResult = useCallback(
    async (peerId: string, jobId: string, index: number, authToken: string, address: string) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }

      const result = await getComputeJobResult(peerId, jobId, index, authToken, address);

      setComputeResult(result);
      return result;
    },
    [isReady, node]
  );

  const fetchConfig = useCallback(
    async (peerId: string, signature: string, expiryTimestamp: number, address: string) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      const result = await fetchNodeConfig(peerId, signature, expiryTimestamp, address);
      setConfig(result);
      return result;
    },
    [isReady, node]
  );

  const pushConfig = useCallback(
    async (
      peerId: string,
      signature: string,
      expiryTimestamp: number,
      config: Record<string, any>,
      address: string
    ) => {
      if (!isReady || !node) {
        throw new Error('Node not ready');
      }
      await pushNodeConfig(peerId, signature, expiryTimestamp, config, address);
      setConfig(config);
    },
    [isReady, node]
  );

  return (
    <P2PContext.Provider
      value={{
        computeLogs,
        computeResult,
        config,
        envs,
        error,
        fetchConfig,
        getComputeResult,
        getEnvs,
        isReady,
        node,
        pushConfig,
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
