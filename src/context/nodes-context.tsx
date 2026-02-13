import { getApiRoute } from '@/config';
import { BenchmarkMinMaxLastResponse, Node, NodeStatsResponse } from '@/types/nodes';
import { JobsPerEpochType, RevenuePerEpochType } from '@/types/stats';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type NodesContextType = {
  benchmarkValues: BenchmarkMinMaxLastResponse;
  jobsPerEpoch: JobsPerEpochType[];
  revenuePerEpoch: RevenuePerEpochType[];
  selectedNode: Node | null;
  totalJobs: number;
  totalRevenue: number;

  fetchNode: (nodeId: string) => Promise<void>;
  fetchNodeBenchmarkMinMaxLast: () => Promise<void>;
  fetchNodeStats: () => Promise<void>;
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
  const [revenuePerEpoch, setRevenuePerEpoch] = useState<RevenuePerEpochType[]>([]);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const fetchNode = useCallback(async (nodeId: string) => {
    try {
      const response = await axios.get(`${getApiRoute('nodes')}?page=0&size=1&nodeId=${nodeId}`);

      if (response.data?.nodes?.length !== 0) {
        setSelectedNode(response.data.nodes[0]._source);
      }
    } catch (error) {
      console.error('Error fetching node benchmark min/max/last: ', error);
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

  return (
    <NodesContext.Provider
      value={{
        benchmarkValues,
        jobsPerEpoch,
        revenuePerEpoch,
        selectedNode,
        totalJobs,
        totalRevenue,
        fetchNode,
        fetchNodeBenchmarkMinMaxLast,
        fetchNodeStats,
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
