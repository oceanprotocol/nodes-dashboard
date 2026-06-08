'use client';

import { useOceanAccount } from '@/lib/use-ocean-account';
import { createAuthToken } from '@/services/nodeService';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef } from 'react';
import { NodeUri } from './P2PContext';

type NodeAuthContextType = {
  getNodeToken: (nodeId: string, nodeUri: NodeUri) => Promise<string>;
  clearNodeToken: (nodeId: string) => void;
  withNodeAuth: <T>(nodeId: string, nodeUri: NodeUri, fn: (token: string) => Promise<T>) => Promise<T>;
};

const NodeAuthContext = createContext<NodeAuthContextType | undefined>(undefined);

export function NodeAuthProvider({ children }: { children: ReactNode }) {
  const { account, signMessage } = useOceanAccount();

  /**
   * Tokens are cached by node ID.
   */
  const tokensRef = useRef<Record<string, string>>({});

  /**
   * Used for preventing duplicate token requests for the same node.
   */
  const inflightRef = useRef<Record<string, Promise<string>>>({});

  /**
   * Used for clearing all node tokens when the wallet address changes.
   */
  const prevAddress = useRef<string | undefined>(account.address);

  useEffect(() => {
    if (prevAddress.current && !account.address) {
      tokensRef.current = {};
      inflightRef.current = {};
    }
    prevAddress.current = account.address;
  }, [account.address]);

  /**
   * Gets a node token for the given node ID and node URI.
   * If the token is already cached, it will be returned.
   * If the token is not cached, a token will be created and cached.
   */
  const getNodeToken = useCallback(
    async (nodeId: string, nodeUri: NodeUri): Promise<string> => {
      if (!account.address) {
        throw new Error('Wallet not connected');
      }
      if (tokensRef.current[nodeId]) {
        return tokensRef.current[nodeId];
      }
      if (nodeId in inflightRef.current) {
        return inflightRef.current[nodeId];
      }
      const promise = createAuthToken({ consumerAddress: account.address, nodeUri, signMessage }).then(
        ({ token }) => {
          tokensRef.current[nodeId] = token;
          delete inflightRef.current[nodeId];
          return token;
        },
        (err) => {
          delete inflightRef.current[nodeId];
          throw err;
        }
      );
      inflightRef.current[nodeId] = promise;
      return promise;
    },
    [account.address, signMessage]
  );

  const clearNodeToken = useCallback((nodeId: string) => {
    delete tokensRef.current[nodeId];
  }, []);

  /**
   * Gets a node token for the given node ID and node URI and executes a function with it.
   * If the token is not cached, it will be created and cached.
   * If the function fails due to auth error, will create a fresh token and retry.
   */
  const withNodeAuth = useCallback(
    async <T,>(nodeId: string, nodeUri: NodeUri, fn: (token: string) => Promise<T>): Promise<T> => {
      const token = await getNodeToken(nodeId, nodeUri);
      try {
        return await fn(token);
      } catch (err: any) {
        const msg = typeof err?.message === 'string' ? err.message.toLowerCase() : '';
        const status = err?.status ?? err?.httpStatus ?? err?.response?.status;
        const isAuthError = status === 401 || /unauthori[sz]ed|token.*expired|invalid token/.test(msg);
        if (!isAuthError) {
          throw err;
        }
        clearNodeToken(nodeId);
        const freshToken = await getNodeToken(nodeId, nodeUri);
        return fn(freshToken);
      }
    },
    [getNodeToken, clearNodeToken]
  );

  return (
    <NodeAuthContext.Provider value={{ getNodeToken, clearNodeToken, withNodeAuth }}>
      {children}
    </NodeAuthContext.Provider>
  );
}

export function useNodeAuth() {
  const ctx = useContext(NodeAuthContext);
  if (!ctx) {
    throw new Error('useNodeAuth must be used within NodeAuthProvider');
  }
  return ctx;
}
