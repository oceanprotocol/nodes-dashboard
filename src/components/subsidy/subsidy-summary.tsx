import { formatSubsidyAmount, formatSubsidyTokenAmount } from '@/components/subsidy/subsidy-copy';
import toneStyles from '@/components/subsidy/subsidy-tone.module.css';
import { formatSubsidyPeriod } from '@/lib/subsidy';
import { useSubsidyProgram } from '@/lib/use-subsidy';
import classNames from 'classnames';
import styles from './subsidy.module.css';

const SubsidySummary = () => {
  const { data: program } = useSubsidyProgram();

  if (!program || (!program.oneTime && !program.discount)) {
    return null;
  }

  const limits = program.discount?.windows.filter((window) => !window.unlimited) ?? [];

  return (
    <div className={styles.summary}>
      <h3>What you get</h3>
      {program.oneTime ? (
        <div className={styles.summaryItem}>
          <span className={classNames(styles.summaryDot, toneStyles.dot, toneStyles.credit)} />
          <strong>{formatSubsidyTokenAmount(program.oneTime.credit)}</strong>
          <span>
            free credit, use across jobs until it runs out
            {program.oneTime.percent < 100 ? `, ${formatSubsidyAmount(program.oneTime.percent)}% of each job` : ''}
          </span>
        </div>
      ) : null}
      {program.discount ? (
        <div className={styles.summaryItem}>
          <span className={classNames(styles.summaryDot, toneStyles.dot, toneStyles.discount)} />
          <strong>{formatSubsidyAmount(program.discount.percent)}% off</strong>
          <span>
            each job
            {limits.length > 0
              ? `, up to ${limits
                  .map(
                    (window) =>
                      `${formatSubsidyTokenAmount(window.limit)} each ${formatSubsidyPeriod(window.periodSeconds)}`
                  )
                  .join(', ')}`
              : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default SubsidySummary;
