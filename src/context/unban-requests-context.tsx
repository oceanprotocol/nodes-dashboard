import { getApiRoute } from '@/config';
import { UnbanRequest, UnbanRequestsResponse } from '@/types/unban-requests';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type UnbanRequestsContextType = {
  unbanRequests: UnbanRequest[];

  fetchUnbanRequests: (nodeId: string) => Promise<void>;
};

const UnbanRequestsContext = createContext<UnbanRequestsContextType | undefined>(undefined);

export const UnbanRequestsProvider = ({ children }: { children: ReactNode }) => {
  const [unbanRequests, setUnbanRequests] = useState<UnbanRequest[]>([]);

  const fetchUnbanRequests = useCallback(async (nodeId: string) => {
    try {
      const response = await axios.get<UnbanRequestsResponse>(
        `${getApiRoute('nodeUnbanRequests')}/${nodeId}/unbanRequests?page=1&size=5`
      );

      if (response.data?.requests?.length !== 0) {
        setUnbanRequests(response.data.requests.map((item, i) => ({ ...item, index: i + 1 })));
      }
    } catch (error) {
      console.error('Error fetching node unban requests: ', error);
    }
  }, []);

  return (
    <UnbanRequestsContext.Provider
      value={{
        unbanRequests,
        fetchUnbanRequests,
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
