'use client';

import type { NodeUri } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { createAuthToken } from '@/services/nodeService';
import { NodeToken, NodeTokens } from '@/types/node-tokens';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type NodeTokensContextType = {
  addNodeToken: (nodeToken: NodeToken) => void;
  nodeTokens: NodeTokens;
  removeNodeToken: (nodeToken: NodeToken) => void;
  /**
   * Returns a usable token for the node, minting one (and prompting for a signature) only when no
   * stored token is still comfortably valid.
   */
  getNodeToken: (nodeId: string, nodeUri: NodeUri) => Promise<string>;
  clearNodeToken: (nodeId: string) => void;
  withNodeAuth: <T>(nodeId: string, nodeUri: NodeUri, fn: (token: string) => Promise<T>) => Promise<T>;
  // True when a non-expired token is already stored for the node — i.e. calling withNodeAuth would
  // NOT trigger a fresh signature prompt. Lets callers auto-fetch only when it's free of a signature.
  hasValidNodeToken: (nodeId: string) => boolean;
};

const LOCAL_STORAGE_KEY_PREFIX = 'node-tokens';

// Lifetime pinned on tokens this provider mints on demand (inference polling, log streams, running
// workloads). The node treats a token with no validUntil as valid forever, so an auto-minted token
// must always be bounded: these are re-minted transparently, so a bounded life costs nothing.
// Tokens the user creates explicitly are NOT subject to this — they keep the expiry the user chose
// (including "no expiration" when the field is left empty).
const AUTO_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours
// Refresh a stored token this long before its node-side expiry, so an in-flight request never lands
// after the node has already invalidated it. Must stay well under AUTO_TOKEN_LIFETIME_MS.
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000; // 1 minute

const NodeTokensContext = createContext<NodeTokensContextType | undefined>(undefined);

/**
 * A stored token is reusable while it is comfortably before its expiry. Tokens with no
 * expiryTimestamp never expire (the user explicitly chose "no expiration").
 */
function isTokenUsable(token: NodeToken | undefined): token is NodeToken {
  if (!token) {
    return false;
  }
  if (!token.expiryTimestamp) {
    return true;
  }
  return token.expiryTimestamp - TOKEN_REFRESH_MARGIN_MS > Date.now();
}

/**
 * Only `string | string[]` survives a localStorage round-trip — a NodeP2P/PeerId carries multiaddr
 * instances that JSON.stringify would flatten into unusable objects. Tokens minted for those are
 * still returned to the caller, just not persisted.
 */
function toStorableNodeUri(nodeUri: NodeUri): string | string[] | undefined {
  if (typeof nodeUri === 'string') {
    return nodeUri;
  }
  if (Array.isArray(nodeUri) && nodeUri.every((entry) => typeof entry === 'string')) {
    return nodeUri;
  }
  return undefined;
}

export const NodeTokensProvider = ({ children }: { children: React.ReactNode }) => {
  const { account, signMessage } = useOceanAccount();
  const addressRef = useRef<string | undefined>(account.address);

  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [nodeTokens, setNodeTokens] = useState<NodeTokens>({});

  /**
   * Write-through mirror of `nodeTokens`, updated synchronously by every mutation below. The async
   * minting path reads this rather than state: React state updates land after commit, so a token
   * just added by getNodeToken would still be invisible to a concurrent caller reading state, and
   * we'd mint a duplicate (burning a node nonce and a signature prompt).
   */
  const nodeTokensRef = useRef<NodeTokens>(nodeTokens);

  /**
   * Single writer for both the ref (synchronous, read by the minting path) and the state (drives
   * the UI). Always mutate tokens through this so the two never diverge.
   */
  const updateNodeTokens = useCallback((updater: (prev: NodeTokens) => NodeTokens) => {
    nodeTokensRef.current = updater(nodeTokensRef.current);
    setNodeTokens(nodeTokensRef.current);
  }, []);

  /**
   * Used for preventing duplicate token requests for the same node.
   */
  const inflightRef = useRef<Record<string, Promise<string>>>({});

  const saveToLocalStorage = useCallback((nodeTokens: NodeTokens) => {
    if (!addressRef.current) {
      return;
    }
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}-${addressRef.current}`, JSON.stringify(nodeTokens));
    } catch (e) {
      console.error('Failed to save node tokens to localStorage:', e);
    }
  }, []);

  const addNodeToken = useCallback(
    (nodeToken: NodeToken) => {
      updateNodeTokens((prev) => ({
        ...prev,
        [nodeToken.nodeId]: [...(prev[nodeToken.nodeId] || []), nodeToken],
      }));
    },
    [updateNodeTokens]
  );

  const removeNodeToken = useCallback(
    (nodeToken: NodeToken) => {
      updateNodeTokens((prev) => ({
        ...prev,
        [nodeToken.nodeId]: (prev[nodeToken.nodeId] || []).filter((t) => t.token !== nodeToken.token),
      }));
    },
    [updateNodeTokens]
  );

  const hydrateFromLocalStorage = useCallback(() => {
    const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}-${account.address}`);
    if (stored) {
      try {
        const parsed: NodeTokens = JSON.parse(stored);
        // Drop tokens the node has already expired — they would otherwise sit in the list as dead
        // rows and, worse, be handed out by getNodeToken.
        const pruned: NodeTokens = {};
        Object.entries(parsed).forEach(([nodeId, tokens]) => {
          const alive = (tokens || []).filter((token) => !token.expiryTimestamp || token.expiryTimestamp > Date.now());
          if (alive.length > 0) {
            pruned[nodeId] = alive;
          }
        });
        updateNodeTokens(() => pruned);
      } catch {
        // Stored data is corrupt; start fresh rather than crashing.
      }
    }
    setIsHydrated(true);
  }, [account.address, updateNodeTokens]);

  /**
   * Clear node tokens when user logs out.
   * Hydrate node tokens when user logs in with a different account.
   */
  useEffect(() => {
    if (!account.address && addressRef.current) {
      // user logged out -> clear node tokens
      // Tokens are bound to the signer's address, so drop the inflight mints too: their results
      // belong to the previous address and the node would reject them for the next one.
      updateNodeTokens(() => ({}));
      inflightRef.current = {};
    }
    if (account.address && (addressRef.current !== account.address || !isHydrated)) {
      // user logged into new account -> hydrate node tokens from local storage
      // app opened, user already logged in -> hydrate node tokens from local storage
      if (addressRef.current && addressRef.current !== account.address) {
        inflightRef.current = {};
      }
      hydrateFromLocalStorage();
    }
    addressRef.current = account.address;
  }, [account.address, hydrateFromLocalStorage, isHydrated, updateNodeTokens]);

  /**
   * Save node tokens to local storage when they change.
   */
  useEffect(() => {
    if (isHydrated) {
      saveToLocalStorage(nodeTokens);
    }
  }, [isHydrated, nodeTokens, saveToLocalStorage]);

  /**
   * Gets a node token for the given node ID and node URI.
   * If a stored token is still valid, it is returned.
   * Otherwise a fresh one is minted (bounded to AUTO_TOKEN_LIFETIME_MS) and stored.
   */
  const getNodeToken = useCallback(
    async (nodeId: string, nodeUri: NodeUri): Promise<string> => {
      if (!account.address) {
        throw new Error('Wallet not connected');
      }
      const usable = (nodeTokensRef.current[nodeId] || []).find(isTokenUsable);
      if (usable) {
        return usable.token;
      }
      // Near-expiry or missing: fall through to mint a fresh one (deduped by inflightRef so
      // concurrent callers share one createAuthToken — a single nonce increment on the node).
      if (nodeId in inflightRef.current) {
        return inflightRef.current[nodeId];
      }
      const validUntil = Date.now() + AUTO_TOKEN_LIFETIME_MS;
      const promise = createAuthToken({
        consumerAddress: account.address,
        nodeUri,
        signMessage,
        issuerPeerId: nodeId,
        validUntil,
      }).then(
        ({ token }) => {
          const storableUri = toStorableNodeUri(nodeUri);
          if (storableUri !== undefined) {
            addNodeToken({
              createdAt: Date.now(),
              expiryTimestamp: validUntil,
              nodeId,
              nodeUri: storableUri,
              token,
            });
          }
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
    [account.address, addNodeToken, signMessage]
  );

  /**
   * Drops every stored token for the node, so the next getNodeToken mints a fresh one. Used when
   * the node rejects a token we believed was still valid.
   */
  const clearNodeToken = useCallback(
    (nodeId: string) => {
      updateNodeTokens((prev) => {
        if (!prev[nodeId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });
    },
    [updateNodeTokens]
  );

  // Mirrors getNodeToken's freshness check, but never mints — so a caller can decide to
  // auto-fetch (no signature prompt) vs. wait for an explicit user action. Requires a connected
  // wallet, since tokens are bound to the signer's address.
  // Reads the ref rather than state so this callback stays identity-stable: consumers put it in
  // effect dep arrays, and re-running those on every token change would re-trigger their fetches.
  const hasValidNodeToken = useCallback(
    (nodeId: string): boolean => {
      if (!account.address) {
        return false;
      }
      return (nodeTokensRef.current[nodeId] || []).some(isTokenUsable);
    },
    [account.address]
  );

  /**
   * Gets a node token for the given node ID and node URI and executes a function with it.
   * If the token is not stored, it will be created and stored.
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
    <NodeTokensContext.Provider
      value={{
        addNodeToken,
        clearNodeToken,
        getNodeToken,
        hasValidNodeToken,
        nodeTokens,
        removeNodeToken,
        withNodeAuth,
      }}
    >
      {children}
    </NodeTokensContext.Provider>
  );
};

export const useNodeTokensContext = () => {
  const context = useContext(NodeTokensContext);
  if (!context) {
    throw new Error('useNodeTokensContext must be used within a NodeTokensProvider');
  }
  return context;
};
