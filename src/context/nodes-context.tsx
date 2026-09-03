import { getApiRoute } from '@/config';
import { BenchmarkMinMaxLastResponse, Node, NodeStatsResponse } from '@/types/nodes';
import { NodeServiceStats, ServiceStatsPerEpoch, ServiceTermBucket } from '@/types/services-stats';
import { JobsPerEpochType, RevenuePerEpochType } from '@/types/stats';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type NodesContextType = {
  benchmarkValues: BenchmarkMinMaxLastResponse;
  jobsPerEpoch: JobsPerEpochType[];
  loadingFetchNode: boolean;
  revenuePerEpoch: RevenuePerEpochType[];
  selectedNode: Node | null;
  // TODO remove once analytics nodes/:id/benchmark is fixed
  temporaryTotalScore: number;
  totalJobs: number;
  totalRevenue: number;
  // Service (inference) stats for the selected node
  serviceStatsPerEpoch: ServiceStatsPerEpoch[];
  serviceTotalServices: number;
  serviceRevenue: number;
  serviceReservedSeconds: number;
  serviceRunningNow: number;
  serviceUniqueConsumers: number;
  serviceByModel: ServiceTermBucket[];

  fetchNode: (nodeId: string) => Promise<void>;
  fetchNodeBenchmarkMinMaxLast: () => Promise<void>;
  fetchNodeStats: () => Promise<void>;
  fetchNodeServiceStats: () => Promise<void>;
  setSelectedNode: (node: Node | null) => void;
};

const NodesContext = createContext<NodesContextType | undefined>(undefined);

export const NodesProvider = ({ children }: { children: ReactNode }) => {
  const [benchmarkValues, setBenchmarkValues] = useState<BenchmarkMinMaxLastResponse>({
    minCPUScore: 0,
    lastCPUScore: 0,
    maxCPUScore: 0,

    minGPUScore: 0,
    lastGPUScore: 0,
    maxGPUScore: 0,
  });
  const [jobsPerEpoch, setJobsPerEpoch] = useState<JobsPerEpochType[]>([]);
  const [loadingFetchNode, setLoadingFetchNode] = useState<boolean>(false);
  const [revenuePerEpoch, setRevenuePerEpoch] = useState<RevenuePerEpochType[]>([]);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  // TODO remove once analytics nodes/:id/benchmark is fixed
  const [temporaryTotalScore, setTemporaryTotalScore] = useState<number>(0);
  const [serviceStatsPerEpoch, setServiceStatsPerEpoch] = useState<ServiceStatsPerEpoch[]>([]);
  const [serviceTotalServices, setServiceTotalServices] = useState<number>(0);
  const [serviceRevenue, setServiceRevenue] = useState<number>(0);
  const [serviceReservedSeconds, setServiceReservedSeconds] = useState<number>(0);
  const [serviceRunningNow, setServiceRunningNow] = useState<number>(0);
  const [serviceUniqueConsumers, setServiceUniqueConsumers] = useState<number>(0);
  const [serviceByModel, setServiceByModel] = useState<ServiceTermBucket[]>([]);

  const fetchNode = useCallback(async (nodeId: string) => {
    setLoadingFetchNode(true);
    try {
      const response = await axios.get(`${getApiRoute('nodes')}?page=0&size=1&nodeId=${nodeId}`);
      if (response.data?.nodes?.length !== 0) {
        setSelectedNode(response.data.nodes[0]._source);
      } else {
        setSelectedNode(null);
      }
    } catch (error) {
      console.error('Error fetching node benchmark min/max/last: ', error);
    } finally {
      setLoadingFetchNode(false);
    }
  }, []);

  const fetchNodeBenchmarkMinMaxLast = useCallback(async () => {
    try {
      const response = await axios.get<BenchmarkMinMaxLastResponse>(
        `${getApiRoute('nodeBenchmarkMinMaxLast')}/${selectedNode?.id}/benchmark`
      );
      if (response.data) {
        const { minGPUScore, lastGPUScore, maxGPUScore, minCPUScore, lastCPUScore, maxCPUScore } = response.data;
        setBenchmarkValues({
          minGPUScore: minGPUScore < lastGPUScore ? minGPUScore : lastGPUScore,
          maxGPUScore: maxGPUScore > lastGPUScore ? maxGPUScore : lastGPUScore,
          lastGPUScore,

          minCPUScore: minCPUScore < lastCPUScore ? minCPUScore : lastCPUScore,
          maxCPUScore: maxCPUScore > lastCPUScore ? maxCPUScore : lastCPUScore,
          lastCPUScore,
        });
      }
    } catch (error) {
      console.error('Error fetching node benchmark min/max/last: ', error);
    }
  }, [selectedNode?.id]);

  const fetchNodeStats = useCallback(async () => {
    try {
      const response = await axios.get<NodeStatsResponse>(`${getApiRoute('nodeStats')}/${selectedNode?.id}/stats`);
      if (response.data) {
        setTotalJobs(response.data.totalJobs);
        setTotalRevenue(response.data.totalRevenue);
        setTemporaryTotalScore(response.data.latestTotalScore);

        const jobsPerEpoch = [];
        const revenuePerEpoch = [];
        for (const epochData of response.data.data) {
          jobsPerEpoch.push({
            epochId: epochData.epochId,
            totalNetworkJobs: epochData.totalNetworkJobs,
            totalBenchmarkJobs: epochData.totalBenchmarkJobs,
            totalJobs: epochData.totalBenchmarkJobs + epochData.totalNetworkJobs,
          });
          revenuePerEpoch.push({
            epochId: epochData.epochId,
            totalNetworkRevenue: epochData.networkRevenue,
            totalBenchmarkRevenue: epochData.benchmarkRevenue,
            totalRevenue: epochData.networkRevenue + epochData.benchmarkRevenue,
          });
        }

        setJobsPerEpoch(jobsPerEpoch);
        setRevenuePerEpoch(revenuePerEpoch);
      }
    } catch (error) {
      console.error('Error fetching node stats:', error);
    }
  }, [selectedNode?.id]);

  const fetchNodeServiceStats = useCallback(async () => {
    try {
      const response = await axios.get<NodeServiceStats>(
        `${getApiRoute('serviceNodeStats')}/${selectedNode?.id}/stats`
      );
      if (response.data) {
        // Rows arrive carrying both the session count and the revenue, so unlike
        // the jobs endpoint nothing has to be summed client-side.
        setServiceStatsPerEpoch(response.data.data ?? []);
        setServiceTotalServices(response.data.totalServices);
        setServiceRevenue(response.data.serviceRevenue);
        setServiceReservedSeconds(response.data.reservedSeconds);
        setServiceRunningNow(response.data.runningNow);
        setServiceUniqueConsumers(response.data.uniqueConsumers);
        // Sessions with no recorded model land in an `unknown` bucket rather than
        // disappearing; drop it so the chart shows only real model names.
        setServiceByModel((response.data.byModel ?? []).filter((bucket) => bucket.key !== 'unknown'));
      }
    } catch (error) {
      console.error('Error fetching node service stats:', error);
    }
  }, [selectedNode?.id]);

  return (
    <NodesContext.Provider
      value={{
        benchmarkValues,
        jobsPerEpoch,
        loadingFetchNode,
        revenuePerEpoch,
        selectedNode,
        temporaryTotalScore,
        totalJobs,
        totalRevenue,
        serviceStatsPerEpoch,
        serviceTotalServices,
        serviceRevenue,
        serviceReservedSeconds,
        serviceRunningNow,
        serviceUniqueConsumers,
        serviceByModel,
        fetchNode,
        fetchNodeBenchmarkMinMaxLast,
        fetchNodeStats,
        fetchNodeServiceStats,
        setSelectedNode,
      }}
    >
      {children}
    </NodesContext.Provider>
  );
};

export const useNodesContext = () => {
  const context = useContext(NodesContext);
  if (!context) {
    throw new Error('useNodesContext must be used within a NodesProvider');
  }
  return context;
};
