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

// Lifetime we pin on cached node tokens. The node treats a token with no validUntil as valid forever
// (sqliteAuthToken: null = never expires), so a leaked cached token would stay usable indefinitely.
// Bound it: cached tokens are re-minted on demand, so a short life costs nothing and caps exposure.
const CACHED_TOKEN_LIFETIME_MS = 30 * 60 * 1000; // 30 minutes
// Refresh a cached token this long before its node-side expiry, so an in-flight request never lands
// after the node has already invalidated it. Must stay well under CACHED_TOKEN_LIFETIME_MS.
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000; // 1 minute

export function NodeAuthProvider({ children }: { children: ReactNode }) {
  const { account, signMessage } = useOceanAccount();

  /**
   * Tokens are cached by node ID, together with the epoch-ms instant they expire (the `validUntil`
   * the node was told). A cached token is only reused while comfortably before that instant — see
   * TOKEN_REFRESH_MARGIN_MS — so we never hand out a token the node is about to reject.
   */
  const tokensRef = useRef<Record<string, { token: string; expiresAt: number }>>({});

  /**
   * Used for preventing duplicate token requests for the same node.
   */
  const inflightRef = useRef<Record<string, Promise<string>>>({});

  /**
   * Used for clearing all node tokens when the wallet address changes.
   */
  const prevAddress = useRef<string | undefined>(account.address);

  useEffect(() => {
    // Tokens are bound to the signer's address — drop them on ANY address change (disconnect OR a
    // switch to a different wallet), otherwise the new address would reuse a token the node rejects.
    if (prevAddress.current && prevAddress.current !== account.address) {
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
      const cached = tokensRef.current[nodeId];
      if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
        return cached.token;
      }
      // Near-expiry or missing: fall through to mint a fresh one (deduped by inflightRef so
      // concurrent callers share one createAuthToken — a single nonce increment on the node).
      if (nodeId in inflightRef.current) {
        return inflightRef.current[nodeId];
      }
      const validUntil = Date.now() + CACHED_TOKEN_LIFETIME_MS;
      const promise = createAuthToken({
        consumerAddress: account.address,
        nodeUri,
        signMessage,
        issuerPeerId: nodeId,
        validUntil,
      }).then(
        ({ token }) => {
          tokensRef.current[nodeId] = { token, expiresAt: validUntil };
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
