import { Node } from '@/types/nodes';
import { createContext, ReactNode, useContext, useState } from 'react';

type NodesContextType = {
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;
};

const NodesContext = createContext<NodesContextType | undefined>(undefined);

export const NodesProvider = ({ children }: { children: ReactNode }) => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  return <NodesContext.Provider value={{ selectedNode, setSelectedNode }}>{children}</NodesContext.Provider>;
};

export const useNodesContext = () => {
  const context = useContext(NodesContext);
  if (!context) {
    throw new Error('useNodesContext must be used within a NodesProvider');
  }
  return context;
};
