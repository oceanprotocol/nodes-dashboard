import { sendCommandToPeerAPI, getNodeEnvsAPI, getNodeStatusAPI, initializeNodeAPI } from '@/services/p2pApiService';
import { ComputeEnvironment } from '@/types/environments';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface P2PContextType {
  isReady: boolean;
  error: string | null;
  envs: ComputeEnvironment[];
  peerId: string | null;
  connectedPeers: number;
  sendCommand: (peerId: string, command: any, protocol?: string) => Promise<any>;
  getEnvs: (peerId: string) => Promise<any>;
  refreshStatus: () => Promise<void>;
}

const P2PContext = createContext<P2PContextType | undefined>(undefined);

export function P2PProvider({ children }: { children: React.ReactNode }) {
  const [envs, setEnvs] = useState<ComputeEnvironment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState(0);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getNodeStatusAPI();
      setIsReady(status.ready);
      setPeerId(status.peerId || null);
      setConnectedPeers(status.connectedPeers || 0);
    } catch (err: any) {
      console.error('Failed to refresh node status:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        console.log('P2PContext: Initializing server-side node...');

        await initializeNodeAPI();

        if (mounted) {
          await refreshStatus();
          console.log('P2PContext: Server-side node ready');
        }
      } catch (err: any) {
        console.error('P2PContext: Failed to initialize:', err);
        if (mounted) {
          setError(err.message);
        }
      }
    }

    init();

    const interval = setInterval(() => {
      if (mounted) {
        refreshStatus();
      }
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshStatus]);

  const sendCommand = useCallback(
    async (peerId: string, command: any, protocol?: string) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      return sendCommandToPeerAPI(peerId, command, protocol);
    },
    [isReady]
  );

  const getEnvs = useCallback(
    async (peerId: string) => {
      if (!isReady) {
        throw new Error('Node not ready');
      }
      const result = await getNodeEnvsAPI(peerId);
      setEnvs(result as ComputeEnvironment[]);
      return result;
    },
    [isReady]
  );

  return (
    <P2PContext.Provider
      value={{
        envs,
        error,
        isReady,
        peerId,
        connectedPeers,
        getEnvs,
        sendCommand,
        refreshStatus,
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
