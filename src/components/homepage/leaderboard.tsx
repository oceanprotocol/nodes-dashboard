import Button from '@/components/button/button';
import Card from '@/components/card/card';
import LeaderboardPreviewTable from '@/components/leaderboard/leaderboard-preview-table';
import Container from '../container/container';
import SectionTitle from '../section-title/section-title';
import styles from './leaderboard.module.css';

export default function LeaderboardSection() {
  return (
    <div className={styles.root}>
      <Container className={styles.relative}>
        <SectionTitle title="Leaderboard Preview" subTitle="Explore the most powerful nodes in the Ocean Network" />
        <Card className={styles.leaderboardWrapper} padding="md" radius="lg" shadow="black" variant="glass-shaded">
          <LeaderboardPreviewTable />
        </Card>
        <div className={styles.leaderboardFooter}>
          <Button color="accent2" href="/leaderboard" size="lg" variant="filled">
            View full leaderboard
          </Button>
        </div>
      </Container>
    </div>
  );
}
