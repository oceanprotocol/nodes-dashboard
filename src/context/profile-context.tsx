import { getApiRoute } from '@/config';
import { EnsProfile } from '@/types/profile';
import {
  ActiveNodes,
  ConsumerStats,
  ConsumerStatsPerEpoch,
  JobsSuccessRate,
  OwnerStats,
  OwnerStatsPerEpoch,
} from '@/types/stats';
import { useAppKitAccount } from '@reown/appkit/react';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

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
  // API functions
  fetchOwnerStats: () => Promise<void>;
  fetchConsumerStats: () => Promise<void>;
  fetchActiveNodes: () => Promise<void>;
  fetchJobsSuccessRate: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const account = useAppKitAccount();

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

  useEffect(() => {
    if (account.status === 'connected' && account.address) {
      fetchEnsAddress(account.address);
      fetchEnsName(account.address);
      fetchEnsProfile(account.address);
    } else {
      setEnsAddress(undefined);
      setEnsName(undefined);
      setEnsProfile(undefined);
    }
  }, [account.address, account.status, fetchEnsAddress, fetchEnsName, fetchEnsProfile]);

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
        fetchOwnerStats,
        fetchConsumerStats,
        fetchActiveNodes,
        fetchJobsSuccessRate,
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
