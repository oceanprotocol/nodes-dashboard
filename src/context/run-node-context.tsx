import { MOCK_NODE_CONFIG } from '@/mock/node-config';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type RunNodeContextType = {
  clearRunNodeSelection: () => void;
  isConnected: boolean;
  nodeConfig: Record<string, any> | null;
  setIsConnected: (connected: boolean) => void;
  setNodeConfig: (config: Record<string, any> | null) => void;
};

const RunNodeContext = createContext<RunNodeContextType | undefined>(undefined);

export const RunNodeProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [nodeConfig, setNodeConfig] = useState<Record<string, any> | null>(MOCK_NODE_CONFIG);

  const clearRunNodeSelection = useCallback(() => {
    setIsConnected(false);
    setNodeConfig(null);
  }, []);

  return (
    <RunNodeContext.Provider
      value={{
        clearRunNodeSelection,
        isConnected,
        nodeConfig,
        setIsConnected,
        setNodeConfig,
      }}
    >
      {children}
    </RunNodeContext.Provider>
  );
};

export const useRunNodeContext = () => {
  const context = useContext(RunNodeContext);
  if (!context) {
    throw new Error('useRunNodeContext must be used within a RunNodeProvider');
  }
  return context;
};
