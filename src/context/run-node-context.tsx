import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { MOCK_NODE_CONFIG } from '@/mock/node-config';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { toast } from 'react-toastify';

type RunNodeContextType = {
  clearRunNodeSelection: () => void;
  connectToNode: (peerId: string) => Promise<void>;
  nodeConfig: Record<string, any> | null;
  peerId: string | null;
  setNodeConfig: (config: Record<string, any> | null) => void;
};

const RunNodeContext = createContext<RunNodeContextType | undefined>(undefined);

export const RunNodeProvider = ({ children }: { children: ReactNode }) => {
  const { account } = useOceanAccount();
  const { sendCommand } = useP2P();

  const [nodeConfig, setNodeConfig] = useState<Record<string, any> | null>(MOCK_NODE_CONFIG);
  const [peerId, setPeerId] = useState<string | null>(null);

  const clearRunNodeSelection = useCallback(() => {
    setNodeConfig(null);
    setPeerId(null);
  }, []);

  const connectToNode = useCallback(
    async (peerId: string) => {
      try {
        const response = await sendCommand(peerId, { command: 'status' });
        if (response.allowedAdmins.includes(account?.address)) {
          setPeerId(peerId);
        } else {
          toast.error('You are not allowed to configure this node');
        }
      } catch (error) {
        toast.error('Failed to connect to node');
      }
    },
    [account?.address, sendCommand]
  );

  return (
    <RunNodeContext.Provider
      value={{
        clearRunNodeSelection,
        connectToNode,
        nodeConfig,
        peerId,
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
