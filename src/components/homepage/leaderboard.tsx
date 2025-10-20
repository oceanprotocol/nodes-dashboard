import { getRoutes } from '@/config';
import Link from 'next/link';
import Container from '../container/container';
import SectionTitle from '../section-title/section-title';
import styles from './leaderboard.module.css';

type LeaderboardItem = {
  nodeId: string;
  gpuCpu: string;
  benchScore: string;
  jobsCompleted: string;
  revenue: string;
};

const columns: { key: keyof LeaderboardItem; label: string }[] = [
  { key: 'nodeId', label: 'Node ID' },
  { key: 'gpuCpu', label: 'GPU/CPU' },
  { key: 'benchScore', label: 'Bench Score' },
  { key: 'jobsCompleted', label: 'Jobs Completed' },
  { key: 'revenue', label: 'Revenue' },
];

const itemsList: LeaderboardItem[] = [
  {
    nodeId: 'Node-12',
    gpuCpu: 'RTX 3090',
    benchScore: '98.2',
    jobsCompleted: '120',
    revenue: '$1,250',
  },
  {
    nodeId: 'Node-23',
    gpuCpu: '16-core CPU',
    benchScore: '87.4',
    jobsCompleted: '90',
    revenue: '$840',
  },
  {
    nodeId: 'Node-41',
    gpuCpu: 'A100 GPU',
    benchScore: '99.1',
    jobsCompleted: '210',
    revenue: '$3,100',
  },
];

export default function LeaderboardSection() {
  const routes = getRoutes();

  return (
    <div className={styles.root}>
      <Container className={styles.relative}>
        <SectionTitle title="Leaderboard Preview" subTitle="Explore the most active nodes in the Ocean Network" />
        <div className={styles.leaderboardWrapper}>
          <div className={`${styles.tableLine} ${styles.tableHeader}`}>
            {columns.map((column) => (
              <div key={column.key} className={styles.tableCell}>
                {column.label}
              </div>
            ))}
          </div>
          {itemsList.map((item) => (
            <div key={item.nodeId} className={styles.tableLine}>
              {columns.map((column) => (
                <div key={column.key} className={styles.tableCell} data-label={column.label}>
                  <span className={styles.tableValue}>{item[column.key]}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.leaderboardFooter}>
          <Link href={routes.leaderboard.path} className={styles.viewButton}>
            View Full Leaderboard
          </Link>
        </div>
      </Container>
    </div>
  );
}
