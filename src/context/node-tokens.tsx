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
  const prevAddress = useRef<string | undefined>(account.address);

  const [nodeTokens, setNodeTokens] = useState<NodeTokens>({});

  const saveToLocalStorage = useCallback(
    (nodeTokens: NodeTokens) => {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}-${account.address}`, JSON.stringify(nodeTokens));
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
      setNodeTokens(JSON.parse(stored));
    }
  }, [account.address]);

  /**
   * Clear node tokens when user logs out.
   * Hydrate node tokens when user logs in with a different account.
   */
  useEffect(() => {
    if (!account.address && prevAddress.current) {
      // user logged out -> clear node tokens
      setNodeTokens({});
    }
    if (account.address && prevAddress.current !== account.address) {
      // user logged in -> hydrate node tokens from local storage
      hydrateFromLocalStorage();
    }
    prevAddress.current = account.address;
  }, [account.address, hydrateFromLocalStorage]);

  /**
   * Save node tokens to local storage when they change.
   */
  useEffect(() => {
    saveToLocalStorage(nodeTokens);
  }, [nodeTokens, saveToLocalStorage]);

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
