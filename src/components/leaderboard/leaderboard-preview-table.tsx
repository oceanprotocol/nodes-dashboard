import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { getApiRoute } from '@/config';
import { Node } from '@/types';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

const PREVIEW_SIZE = 5;

async function fetchNodeJobStats(nodeId: string) {
  const result = await axios.get(`${getApiRoute('nodeStats')}/${nodeId}/stats`);

  return { ...result.data, nodeId };
}

/** Top nodes by benchmark score, with their job stats. Used on the homepage and stats page. */
export default function LeaderboardPreviewTable() {
  const [topNodes, setTopNodes] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get<{ nodes: Node[] }>(getApiRoute('nodes'), {
        params: {
          filters: JSON.stringify({
            hidden: { operator: 'equals', value: false },
            eligible: { operator: 'equals', value: true },
          }),
          page: 0,
          size: PREVIEW_SIZE,
          sort: JSON.stringify({
            'latestBenchmarkResults.totalScore': 'desc',
          }),
        },
      });
      const sanitizedData = response.data.nodes.map((element: any) => element._source);

      const results = await Promise.all(sanitizedData.map((node: Node) => fetchNodeJobStats(node.id)));
      results.forEach((result) => {
        const currentNodeIndex = sanitizedData.findIndex((item: Node) => item.id === result.nodeId);
        sanitizedData[currentNodeIndex] = {
          ...sanitizedData[currentNodeIndex],
          totalJobs: result.totalJobs,
          totalRevenue: result.totalRevenue,
        };
      });

      setTopNodes(sanitizedData);
    } catch (error) {
      console.error('Error fetching leaderboard preview data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Table<Node>
      autoHeight
      data={topNodes}
      getRowId={(row) => row.id ?? row.nodeId}
      loading={isLoading}
      paginationType="none"
      tableType={TableTypeEnum.NODES_LEADERBOARD_HOME}
    />
  );
}
