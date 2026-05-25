import { useOceanAccount } from '@/lib/use-ocean-account';
import { NodeToken, NodeTokens } from '@/types/node-tokens';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type NodeTokensContextType = {
  addNodeToken: (nodeToken: NodeToken) => void;
  nodeTokens: NodeTokens;
  removeNodeToken: (nodeToken: NodeToken) => void;
};

const LOCAL_STORAGE_KEY_PREFIX = 'node-tokens';

const NodeTokensContext = createContext<NodeTokensContextType | undefined>(undefined);

export const NodeTokensProvider = ({ children }: { children: React.ReactNode }) => {
  const { account } = useOceanAccount();
  const addressRef = useRef<string | undefined>(account.address);
  addressRef.current = account.address;

  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [nodeTokens, setNodeTokens] = useState<NodeTokens>({});

  const saveToLocalStorage = useCallback(
    (nodeTokens: NodeTokens) => {
      if (!addressRef.current) {
        return;
      }
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}-${account.address}`, JSON.stringify(nodeTokens));
      } catch (e) {
        console.error('Failed to save node tokens to localStorage:', e);
      }
    },
    [account.address]
  );

  const addNodeToken = useCallback((nodeToken: NodeToken) => {
    setNodeTokens((prev) => ({
      ...prev,
      [nodeToken.nodeId]: [...(prev[nodeToken.nodeId] || []), nodeToken],
    }));
  }, []);

  const removeNodeToken = useCallback((nodeToken: NodeToken) => {
    setNodeTokens((prev) => ({
      ...prev,
      [nodeToken.nodeId]: prev[nodeToken.nodeId].filter((t) => t.token !== nodeToken.token),
    }));
  }, []);

  const hydrateFromLocalStorage = useCallback(() => {
    const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}-${account.address}`);
    if (stored) {
      try {
        setNodeTokens(JSON.parse(stored));
      } catch {
        // Stored data is corrupt; start fresh rather than crashing.
      }
    }
    setIsHydrated(true);
  }, [account.address]);

  /**
   * Clear node tokens when user logs out.
   * Hydrate node tokens when user logs in with a different account.
   */
  useEffect(() => {
    if (!account.address && addressRef.current) {
      // user logged out -> clear node tokens
      setNodeTokens({});
    }
    if (account.address && (addressRef.current !== account.address || !isHydrated)) {
      // user logged into new account -> hydrate node tokens from local storage
      // app opened, user already logged in -> hydrate node tokens from local storage
      hydrateFromLocalStorage();
    }
    addressRef.current = account.address;
  }, [account.address, hydrateFromLocalStorage, isHydrated]);

  /**
   * Save node tokens to local storage when they change.
   */
  useEffect(() => {
    if (isHydrated) {
      saveToLocalStorage(nodeTokens);
    }
  }, [isHydrated, nodeTokens, saveToLocalStorage]);

  return (
    <NodeTokensContext.Provider
      value={{
        addNodeToken,
        nodeTokens,
        removeNodeToken,
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
