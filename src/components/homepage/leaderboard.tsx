import Card from '@/components/card/card';
import { getApiRoute, getRoutes } from '@/config';
import { Node } from '@/types';
import axios from 'axios';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Container from '../container/container';
import SectionTitle from '../section-title/section-title';
import styles from './leaderboard.module.css';

type LeaderboardItem = {
  nodeId: string;
  gpuCpu: string;
  benchScore: number;
  jobsCompleted: number;
  revenue: string;
};

const columns: { key: keyof LeaderboardItem; label: string }[] = [
  { key: 'nodeId', label: 'Node ID' },
  { key: 'gpuCpu', label: 'GPU/CPU' },
  { key: 'benchScore', label: 'Bench Score' },
  { key: 'jobsCompleted', label: 'Jobs Completed' },
  { key: 'revenue', label: 'Revenue' },
];

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
      const response = await axios.get(
        `${getApiRoute('nodes')}?page=0&size=3&sort[latestBenchmarkResults.gpuScore]=desc`
      );
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
          total_jobs: result.total_jobs,
          total_revenue: result.total_revenue,
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

  const itemsList: LeaderboardItem[] = useMemo(
    () =>
      topNodes.map((node) => ({
        nodeId: node.friendlyName ?? node.id ?? '-',
        gpuCpu: formatNodeGPUCPU(node),
        benchScore: node.latestBenchmarkResults.gpuScore,
        jobsCompleted: node.total_jobs,
        revenue: `USDC ${node.total_revenue.toFixed(2)}`,
      })),
    [topNodes]
  );

  return (
    <div className={styles.root}>
      <Container className={styles.relative}>
        <SectionTitle title="Leaderboard Preview" subTitle="Explore the most active nodes in the Ocean Network" />
        <Card className={styles.leaderboardWrapper} padding="md" radius="lg" variant="glass-shaded">
          <div className={`${styles.tableLine} ${styles.tableHeader}`}>
            {columns.map((column) => (
              <div key={column.key} className={styles.tableCell}>
                {column.label}
              </div>
            ))}
          </div>
          {isLoading ? (
            <div className={styles.loader}>Loading...</div>
          ) : (
            itemsList.map((item, index) => (
              <div key={`${item.nodeId}-${index}`} className={styles.tableLine}>
                {columns.map((column) => (
                  <div key={column.key} className={styles.tableCell} data-label={column.label}>
                    <span className={styles.tableValue}>{item[column.key]}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </Card>
        <div className={styles.leaderboardFooter}>
          <Link href={routes.leaderboard.path} className={styles.viewButton}>
            View Full Leaderboard
          </Link>
        </div>
      </Container>
    </div>
  );
}
