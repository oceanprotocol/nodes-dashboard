import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type RunNodeContextType = {
  clearRunNodeSelection: () => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
};

const RunNodeContext = createContext<RunNodeContextType | undefined>(undefined);

export const RunNodeProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const clearRunNodeSelection = useCallback(() => {
    setIsConnected(false);
  }, []);

  return (
    <RunNodeContext.Provider
      value={{
        clearRunNodeSelection,
        isConnected,
        setIsConnected,
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
