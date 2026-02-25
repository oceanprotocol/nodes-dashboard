import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import posthog from 'posthog-js';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { toast } from 'react-toastify';

type RunNodeContextType = {
  clearRunNodeSelection: () => void;
  configErrors: string[];
  connectToNode: (peerId: string) => Promise<void>;
  fetchConfig: () => Promise<void>;
  loadingFetchConfig: boolean;
  loadingPushConfig: boolean;
  nodeConfig: Record<string, any> | null;
  peerId: string | null;
  pushConfig: (config: Record<string, any>) => Promise<void>;
  setNodeConfig: (config: Record<string, any> | null) => void;
};

const RunNodeContext = createContext<RunNodeContextType | undefined>(undefined);

export const RunNodeProvider = ({ children }: { children: ReactNode }) => {
  const { fetchConfig: p2pFetchConfig, pushConfig: p2pPushConfig, sendCommand } = useP2P();

  const { account, signMessage, user } = useOceanAccount();

  const [configErrors, setConfigErrors] = useState<string[]>([]);
  const [nodeConfig, setNodeConfig] = useState<Record<string, any> | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);

  const [loadingFetchConfig, setLoadingFetchConfig] = useState<boolean>(false);
  const [loadingPushConfig, setLoadingPushConfig] = useState<boolean>(false);

  const clearRunNodeSelection = useCallback(() => {
    setConfigErrors([]);
    setNodeConfig(null);
    setPeerId(null);
  }, []);

  const connectToNode = useCallback(
    async (peerId: string) => {
      try {
        const response = await sendCommand(peerId, { command: 'status' });
        if (response.allowedAdmins.addresses.includes(account?.address)) {
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

  const fetchConfig = useCallback(async () => {
    if (!peerId || !account?.address) {
      return;
    }
    setLoadingFetchConfig(true);
    try {
      const config = await p2pFetchConfig({
        consumerAddress: user?.type === 'sca' ? account.address : undefined,
        expiryTimestamp: Date.now() + 5 * 60 * 1000, // 5 minutes expiry
        multiaddrsOrPeerId: peerId,
        signMessage,
      });
      setNodeConfig(config);
      posthog.capture('runNode_fetchConfig', {
        peerId,
      });
    } catch (error) {
      console.error('Error fetching node config:', error);
      toast.error('Failed to fetch node config');
    } finally {
      setLoadingFetchConfig(false);
    }
  }, [account.address, p2pFetchConfig, peerId, signMessage, user?.type]);

  const pushConfig = useCallback(
    async (config: Record<string, any>) => {
      if (!peerId || !account?.address) {
        return;
      }
      let success = false;
      setLoadingPushConfig(true);
      try {
        await p2pPushConfig({
          config,
          consumerAddress: user?.type === 'sca' ? account.address : undefined,
          expiryTimestamp: Date.now() + 5 * 60 * 1000, // 5 minutes expiry
          multiaddrsOrPeerId: peerId,
          signMessage,
        });
        setNodeConfig(config);
        setConfigErrors([]);
        success = true;
        posthog.capture('runNode_pushConfig', {
          peerId,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.startsWith('Config validation failed:')) {
            // erase the prefix
            const validationErrors = error.message.replace('Config validation failed: ', '').trim();
            // split the errors, shaped like "field1: field1 error, with comma in the erorr message, field2: field2 error, field3: field3 error, ..."
            setConfigErrors(validationErrors.split(/, (?=[a-zA-Z0-9.]+:\s)/));
          }
        }
        console.error('Error pushing node config:', error);
      } finally {
        setLoadingPushConfig(false);
        if (success) {
          toast.success('Successfully pushed new config!');
        } else {
          toast.error('Failed to push new config');
        }
      }
    },
    [peerId, account.address, signMessage, p2pPushConfig]
  );

  return (
    <RunNodeContext.Provider
      value={{
        clearRunNodeSelection,
        configErrors,
        connectToNode,
        fetchConfig,
        loadingFetchConfig,
        loadingPushConfig,
        nodeConfig,
        peerId,
        pushConfig,
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
