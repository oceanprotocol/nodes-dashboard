import Card from '@/components/card/card';
import { formatSubsidyAmount, formatSubsidyTokenAmount } from '@/components/subsidy/subsidy-copy';
import { SubsidyHistoryEntry } from '@/lib/subsidy';
import { useSubsidyHistory, useSubsidyProgram } from '@/lib/use-subsidy';
import { formatWalletAddress } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import dayjs from 'dayjs';
import styles from './subsidy-section.module.css';

const formatJobId = (jobId: string) => (jobId.length > 12 ? `${jobId.slice(0, 6)}…${jobId.slice(-4)}` : jobId);

const SubsidyHistory = () => {
  const { data: program } = useSubsidyProgram();
  const { data: history, isError, isLoading } = useSubsidyHistory();

  const describe = (entry: SubsidyHistoryEntry) =>
    [
      entry.oneTime > 0 ? 'On us' : null,
      entry.discount > 0 && program?.discount ? `${formatSubsidyAmount(program.discount.percent)}% off` : null,
    ]
      .filter(Boolean)
      .join(' + ');

  const renderBody = () => {
    if (isLoading) {
      return <CircularProgress className="alignSelfCenter" />;
    }
    if (isError) {
      return <span className={styles.small}>Couldn&apos;t load your subsidy history. Try again later.</span>;
    }
    if (!history || history.length === 0) {
      return <span className={styles.small}>No subsidized jobs or services yet.</span>;
    }
    const total = history.reduce((sum, entry) => sum + entry.total, 0);
    return (
      <>
        <span className={styles.small}>
          Total subsidized so far: <strong>{formatSubsidyTokenAmount(total)}</strong> across {history.length}{' '}
          {history.length === 1 ? 'job or service' : 'jobs and services'}
        </span>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Job / service ID</th>
                <th>Node</th>
                <th>Subsidy</th>
                <th>Subsidized</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={`${entry.node}-${entry.jobId}`}>
                  <td>{entry.date ? dayjs(entry.date).format('MMM D, HH:mm') : '—'}</td>
                  <td className={styles.mono} title={entry.jobId}>
                    {formatJobId(entry.jobId)}
                  </td>
                  <td className={styles.mono} title={entry.node}>
                    {formatWalletAddress(entry.node)}
                  </td>
                  <td>{describe(entry)}</td>
                  <td className={styles.subsidized}>{formatSubsidyTokenAmount(entry.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h4 className={styles.historyTitle}>Subsidy history</h4>
      {renderBody()}
    </Card>
  );
};

export default SubsidyHistory;
