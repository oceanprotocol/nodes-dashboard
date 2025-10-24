import { createContext, ReactNode, useContext } from 'react';

type NodesContextType = {};

const NodesContext = createContext<NodesContextType | undefined>(undefined);

export const NodesProvider = ({ children }: { children: ReactNode }) => {
  return <NodesContext.Provider value={{}}>{children}</NodesContext.Provider>;
};

export const useNodesContext = () => {
  const context = useContext(NodesContext);
  if (!context) {
    throw new Error('useNodesContext must be used within a NodesProvider');
  }
  return context;
};
