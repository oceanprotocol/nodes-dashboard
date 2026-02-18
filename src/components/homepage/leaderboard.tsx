import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { getApiRoute, getRoutes } from '@/config';
import { Node } from '@/types';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import Container from '../container/container';
import SectionTitle from '../section-title/section-title';
import styles from './leaderboard.module.css';

export default function LeaderboardSection() {
  const routes = getRoutes();
  const [topNodes, setTopNodes] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchNodeJobStats(nodeId: string) {
    const result = await axios.get(`${getApiRoute('nodeStats')}/${nodeId}/stats`);

    return { ...result.data, nodeId };
  }

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
          size: 3,
          sort: JSON.stringify({
            'latestBenchmarkResults.totalScore': 'desc',
          }),
        },
      });
      const sanitizedData = response.data.nodes.map((element: any) => element._source);

      const promises = [];
      for (const node of sanitizedData) {
        promises.push(fetchNodeJobStats(node.id));
      }
      const results = await Promise.all(promises);
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
      console.log(error);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const fetchAllData = async () => {
      if (!mounted) return;
      try {
        await fetchData();
      } catch (error) {
        console.error('Error fetching initial leaderboard data:', error);
      } finally {
        if (mounted) {
          // setOverallDashboardLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [fetchData]);

  function formatNodeGPUCPU(node: Node) {
    if (node.gpus) {
      return node.gpus.map((gpu) => `${gpu.vendor} ${gpu.name}`).join(', ');
    } else if (node.cpus) {
      return node.cpus.map((cpu) => cpu.model).join(', ');
    }
    return '-';
  }

  return (
    <div className={styles.root}>
      <Container className={styles.relative}>
        <SectionTitle title="Leaderboard Preview" subTitle="Explore the most active nodes in the Ocean Network" />
        <Card className={styles.leaderboardWrapper} padding="md" radius="lg" shadow="black" variant="glass-shaded">
          <Table<Node>
            autoHeight
            data={topNodes}
            getRowId={(row) => row.id ?? row.nodeId}
            loading={isLoading}
            paginationType="none"
            tableType={TableTypeEnum.NODES_LEADERBOARD_HOME}
          />
        </Card>
        <div className={styles.leaderboardFooter}>
          <Button color="accent2" href={routes.leaderboard.path} size="lg" variant="filled">
            View full leaderboard
          </Button>
        </div>
      </Container>
    </div>
  );
}
