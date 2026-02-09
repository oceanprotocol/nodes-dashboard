import { getApiRoute } from '@/config';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { EnvNodeInfo } from '@/types/environments';
import { GrantStatus } from '@/types/grant';
import { EnsProfile } from '@/types/profile';
import {
  ActiveNodes,
  ConsumerStats,
  ConsumerStatsPerEpoch,
  JobsSuccessRate,
  OwnerStats,
  OwnerStatsPerEpoch,
} from '@/types/stats';
import { useSendUserOperation } from '@account-kit/react';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ProfileContextType = {
  ensName: string | undefined;
  ensAddress: string | undefined;
  ensProfile: EnsProfile | undefined;
  // Owner stats
  totalNetworkRevenue: number;
  totalBenchmarkRevenue: number;
  totalNetworkJobs: number;
  totalBenchmarkJobs: number;
  ownerStatsPerEpoch: OwnerStatsPerEpoch[];
  eligibleNodes: number;
  totalNodes: number;
  //Consumer stats
  totalJobs: number;
  totalPaidAmount: number;
  consumerStatsPerEpoch: ConsumerStatsPerEpoch[];
  successfullJobs: number;
  environment: any;
  nodeInfo: EnvNodeInfo;
  grantStatus: GrantStatus | null;
  // API functions
  fetchOwnerStats: () => Promise<void>;
  fetchConsumerStats: () => Promise<void>;
  fetchActiveNodes: () => Promise<void>;
  fetchGrantStatus: (walletAddress: string) => Promise<void>;
  fetchJobsSuccessRate: () => Promise<void>;
  fetchNodeEnv: (peerId: string, envId: string) => Promise<any>;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { account, client } = useOceanAccount();
  const { sendUserOperationAsync } = useSendUserOperation({
    client,
    waitForTxn: true,
  });

  const [ensAddress, setEnsAddress] = useState<ProfileContextType['ensAddress']>(undefined);
  const [ensName, setEnsName] = useState<ProfileContextType['ensName']>(undefined);
  const [ensProfile, setEnsProfile] = useState<ProfileContextType['ensProfile']>(undefined);
  const [totalNetworkRevenue, setTotalNetworkRevenue] = useState<number>(0);
  const [totalBenchmarkRevenue, setTotalBenchmarkRevenue] = useState<number>(0);
  const [totalNetworkJobs, setTotalNetworkJobs] = useState<number>(0);
  const [totalBenchmarkJobs, setTotalBenchmarkJobs] = useState<number>(0);
  const [ownerStatsPerEpoch, setOwnerStatsPerEpoch] = useState<OwnerStatsPerEpoch[]>([]);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [totalPaidAmount, setTotalPaidAmount] = useState<number>(0);
  const [consumerStatsPerEpoch, setConsumerStatsPerEpoch] = useState<ConsumerStatsPerEpoch[]>([]);
  const [eligibleNodes, setEligibleNodes] = useState<number>(0);
  const [totalNodes, setTotalNodes] = useState<number>(0);
  const [successfullJobs, setSuccessfullJobs] = useState<number>(0);
  const [environment, setEnvironment] = useState<any>(null);
  const [nodeInfo, setNodeInfo] = useState<any>();
  const [grantStatus, setGrantStatus] = useState<GrantStatus | null>(null);

  // Ref to track deployment attempts and prevent infinite loop
  const deploymentAttempted = useRef<string | null>(null);

  const fetchEnsAddress = useCallback(async (accountId: string) => {
    if (!accountId || accountId === '' || !accountId.includes('.')) {
      return;
    }
    try {
      const response = await axios.get(`${getApiRoute('ensAddress')}?name=${accountId}`);
      if (response.data?.address) {
        setEnsAddress(response.data.address);
      }
    } catch (error) {
      console.error('Error fetching ENS address:', error);
    }
  }, []);

  const fetchEnsName = useCallback(async (accountId: string) => {
    if (!accountId || accountId === '') {
      return;
    }
    try {
      const response = await axios.get(`${getApiRoute('ensName')}?accountId=${accountId}`);
      if (response.data?.name) {
        setEnsName(response.data.name);
      }
    } catch (error) {
      console.error('Error fetching ENS name:', error);
    }
  }, []);

  const fetchEnsProfile = useCallback(async (accountId: string) => {
    if (!accountId || accountId === '') {
      return;
    }
    try {
      const response = await axios.get(`${getApiRoute('ensProfile')}?address=${accountId}`);
      if (response.data?.profile) {
        setEnsProfile(response.data.profile);
      }
    } catch (error) {
      console.error('Error fetching ENS profile:', error);
    }
  }, []);

  const fetchOwnerStats = useCallback(async () => {
    try {
      const response = await axios.get<OwnerStats>(`${getApiRoute('ownerStats')}/${ensAddress}/stats`);
      if (response.data) {
        setTotalNetworkRevenue(response.data.totalNetworkRevenue);
        setTotalBenchmarkRevenue(response.data.totalBenchmarkRevenue);
        setTotalNetworkJobs(response.data.totalNetworkJobs);
        setTotalBenchmarkJobs(response.data.totalBenchmarkJobs);
        setTotalJobs(response.data.totalNetworkJobs + response.data.totalBenchmarkJobs);
        setOwnerStatsPerEpoch(response.data.data);

        const totalsPerEpoch = response.data.data.map((item) => {
          return {
            epochId: item.epochId,
            totalNetworkRevenue: item.totalNetworkRevenue,
            totalBenchmarkRevenue: item.totalBenchmarkRevenue,
            totalBenchmarkJobs: item.totalBenchmarkJobs,
            totalNetworkJobs: item.totalNetworkJobs,
            totalRevenue: item.totalNetworkRevenue + item.totalBenchmarkRevenue,
            totalJobs: item.totalNetworkJobs + item.totalBenchmarkJobs,
          };
        });
        setOwnerStatsPerEpoch(totalsPerEpoch);
      }
    } catch (err) {
      console.error('Error fetching owner stats: ', err);
    }
  }, []);

  const fetchConsumerStats = useCallback(async () => {
    try {
      const response = await axios.get<ConsumerStats>(`${getApiRoute('consumerStats')}/${ensAddress}/stats`);
      if (response.data) {
        setTotalJobs(response.data.totalJobs);
        setTotalPaidAmount(response.data.totalPaidAmount);
        setConsumerStatsPerEpoch(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching consumer stats: ', err);
    }
  }, []);

  const fetchActiveNodes = useCallback(async () => {
    try {
      const response = await axios.get<ActiveNodes>(`${getApiRoute('nodesStats')}/${ensAddress}/nodesStats`);
      if (response.data) {
        setEligibleNodes(response.data.activeCount);
        setTotalNodes(response.data.totalCount);
      }
    } catch (err) {
      console.error('Error fetching active nodes: ', err);
    }
  }, []);

  const fetchJobsSuccessRate = useCallback(async () => {
    try {
      const response = await axios.get<JobsSuccessRate>(
        `${getApiRoute('jobsSuccessRate')}/${ensAddress}/jobs-success-rate`
      );
      if (response.data) {
        setSuccessfullJobs(response.data.successCount);
        setTotalJobs(response.data.totalCount);
      }
    } catch (err) {
      console.error('Error fetching jobs success rate: ', err);
    }
  }, []);

  const fetchNodeEnv = useCallback(async (peerId: string, envId: string) => {
    try {
      const response = await axios.get(`${getApiRoute('nodes')}?filters[id][value]=${peerId}`);
      const sanitizedData = response.data.nodes.map((element: any) => element._source)[0];
      const env = sanitizedData.computeEnvironments.environments.find((env: any) => env.id === envId);
      setEnvironment(env);
      setNodeInfo({ id: sanitizedData.id, friendlyName: sanitizedData.friendlyName });
    } catch (err) {
      console.error('Error fetching node env: ', err);
    }
  }, []);

  const fetchGrantStatus = useCallback(async (walletAddress: string) => {
    try {
      const response = await axios.get<GrantStatus>('api/grant/status', {
        params: {
          walletAddress,
        },
      });
      if (response.data) {
        setGrantStatus(response.data);
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setGrantStatus(null);
      } else {
        console.error('Error fetching grant status: ', err);
      }
    }
  }, []);

  // Handle profile fetching when connected
  useEffect(() => {
    if (account.isConnected && account.address) {
      fetchEnsAddress(account.address);
      fetchEnsName(account.address);
      fetchEnsProfile(account.address);
      fetchGrantStatus(account.address);
    } else {
      setEnsAddress(undefined);
      setEnsName(undefined);
      setEnsProfile(undefined);
    }
  }, [account.address, account.isConnected, fetchEnsAddress, fetchEnsName, fetchEnsProfile, fetchGrantStatus]);

  // Auto-deploy account if needed when user connects
  useEffect(() => {
    // Skip if we've already attempted deployment for this address
    if (deploymentAttempted.current === account.address) {
      return;
    }

    const handleAutoDeployment = async () => {
      if (account.isConnected && account.address && client?.account) {
        const isDeployed = await client.account.isAccountDeployed();

        if (!isDeployed) {
          // Mark that we're attempting deployment for this address
          deploymentAttempted.current = account.address;

          try {
            console.log('Deploying account for:', account.address);
            await sendUserOperationAsync({
              uo: {
                target: account.address as `0x${string}`,
                data: '0x' as `0x${string}`,
                value: BigInt(0),
              },
            });
            console.log('Account deployed successfully');
          } catch (error) {
            console.error('Error deploying account:', error);
            // Reset on error so user can retry manually if needed
            deploymentAttempted.current = null;
          }
        }
      }
    };

    handleAutoDeployment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.isConnected, account.address, client]);

  return (
    <ProfileContext.Provider
      value={{
        ensAddress,
        ensName,
        ensProfile,
        totalNetworkRevenue,
        totalBenchmarkRevenue,
        totalNetworkJobs,
        totalBenchmarkJobs,
        ownerStatsPerEpoch,
        totalJobs,
        totalPaidAmount,
        consumerStatsPerEpoch,
        eligibleNodes,
        totalNodes,
        successfullJobs,
        environment,
        nodeInfo,
        grantStatus,
        fetchOwnerStats,
        fetchConsumerStats,
        fetchActiveNodes,
        fetchGrantStatus,
        fetchJobsSuccessRate,
        fetchNodeEnv,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfileContext = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  }
  return context;
};
