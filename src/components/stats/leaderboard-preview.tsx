import Button from '@/components/button/button';
import Card from '@/components/card/card';
import LeaderboardPreviewTable from '@/components/leaderboard/leaderboard-preview-table';

const LeaderboardPreview = () => {
  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Leaderboard preview</h3>
      <LeaderboardPreviewTable />
      <Button className="alignSelfCenter" color="accent2" href="/leaderboard" size="md" variant="filled">
        View full leaderboard
      </Button>
    </Card>
  );
};

export default LeaderboardPreview;
