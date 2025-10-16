import cx from 'classnames';
import Container from '../container/container';
import SectionTitle from '../section-title/section-title';
import styles from './leaderboard.module.css';

const itemsList: {
  nodeid: string;
  gpuCpu: string;
  benchScore: string;
  jobsCompleted: string;
  revenue: string;
}[] = [
  {
    nodeid: 'Node-12',
    gpuCpu: 'RTX 3090',
    benchScore: '98.2',
    jobsCompleted: '120',
    revenue: '$1,250',
  },
  {
    nodeid: 'Node-23',
    gpuCpu: '16-core CPU',
    benchScore: '87.4',
    jobsCompleted: '90',
    revenue: '$840',
  },
  {
    nodeid: 'Node-41',
    gpuCpu: 'A100 GPU',
    benchScore: '99.1',
    jobsCompleted: '210',
    revenue: '$3,100',
  },
];

export default function LeaderboardSection() {
  return (
    <div className={styles.root}>
      <Container className={styles.relative}>
        <SectionTitle title="Leaderboard Preview" subTitle="Explore the most active nodes in the Ocean Network" />
        <div className={styles.leaderboardWrapper}>
          <div className={cx(styles.tableLine, styles.tableHeader)}>
            <div className={styles.tableCell}>Node ID</div>
            <div className={styles.tableCell}>GPU/CPU</div>
            <div className={styles.tableCell}>Bench Score</div>
            <div className={styles.tableCell}>Jobs Completed</div>
            <div className={styles.tableCell}>Revenue</div>
          </div>
          {itemsList.map((item) => (
            <div key={item.nodeid} className={styles.tableLine}>
              <div className={styles.tableCell}>{item.nodeid}</div>
              <div className={styles.tableCell}>{item.gpuCpu}</div>
              <div className={styles.tableCell}>{item.benchScore}</div>
              <div className={styles.tableCell}>{item.jobsCompleted}</div>
              <div className={styles.tableCell}>{item.revenue}</div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
