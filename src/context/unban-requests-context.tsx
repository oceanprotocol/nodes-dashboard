import { getApiRoute } from '@/config';
import { UnbanRequest, UnbanRequestsResponse } from '@/types/unban-requests';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type UnbanResult = {
  success: boolean;
  message?: string;
};

type UnbanRequestsContextType = {
  unbanRequests: UnbanRequest[];

  fetchUnbanRequests: (nodeId: string) => Promise<void>;
  requestNodeUnban: (
    nodeId: string,
    signature: string,
    expiryTimestamp: number,
    address: string
  ) => Promise<UnbanResult>;
};

const UnbanRequestsContext = createContext<UnbanRequestsContextType | undefined>(undefined);

export const UnbanRequestsProvider = ({ children }: { children: ReactNode }) => {
  const [unbanRequests, setUnbanRequests] = useState<UnbanRequest[]>([]);

  const fetchUnbanRequests = useCallback(async (nodeId: string) => {
    setUnbanRequests([]);
    try {
      const response = await axios.get<UnbanRequestsResponse>(
        `${getApiRoute('nodeUnbanRequests')}/${nodeId}/unbanRequests?page=1&size=5`
      );

      if (response.data?.requests?.length !== 0) {
        setUnbanRequests(response.data.requests.map((item: any, i) => ({ ...(item._source ?? item), index: i + 1 })));
      }
    } catch (error) {
      console.error('Error fetching node unban requests: ', error);
    }
  }, []);

  const requestNodeUnban = useCallback(
    async (nodeId: string, signature: string, expiryTimestamp: number, address: string): Promise<UnbanResult> => {
      try {
        const response = await axios.post<UnbanResult>(
          `${getApiRoute('nodeUnbanRequests')}/${nodeId}/unban`,
          { signature, expiryTimestamp, address }
        );
        return {
          success: response.data?.success ?? true,
          message: response.data?.message,
        };
      } catch (error) {
        console.error('Error requesting node unban: ', error);
        const message = axios.isAxiosError(error)
          ? error.response?.data?.message ?? error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error';
        return { success: false, message };
      }
    },
    []
  );

  return (
    <UnbanRequestsContext.Provider
      value={{
        unbanRequests,
        fetchUnbanRequests,
        requestNodeUnban,
      }}
    >
      {children}
    </UnbanRequestsContext.Provider>
  );
};

export const useUnbanRequestsContext = () => {
  const context = useContext(UnbanRequestsContext);
  if (!context) {
    throw new Error('useUnbanRequestsContext must be used within a UnbanRequestsProvider');
  }
  return context;
};
