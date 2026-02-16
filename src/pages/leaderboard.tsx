import LeaderboardPage from '@/components/leaderboard/leaderboard-page';
import { LeaderboardTableProvider } from '@/context/table/leaderboard-table-context';

const LeaderboardPageWrapper: React.FC = () => {
  return (
    <LeaderboardTableProvider>
      <LeaderboardPage />
    </LeaderboardTableProvider>
  );
};

export default LeaderboardPageWrapper;
