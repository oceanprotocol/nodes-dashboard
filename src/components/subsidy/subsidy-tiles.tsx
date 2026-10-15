import Card from '@/components/card/card';
import { formatSubsidyAmount } from '@/components/subsidy/subsidy-copy';
import toneStyles from '@/components/subsidy/subsidy-tone.module.css';
import { SUBSIDY_TOKEN_SYMBOL } from '@/constants/subsidy';
import { formatSubsidyPeriod } from '@/lib/subsidy';
import { useSubsidyProgram } from '@/lib/use-subsidy';
import classNames from 'classnames';
import styles from './subsidy.module.css';

type SubsidyTilesProps = {
  /** Blocked on an earlier step. */
  muted?: boolean;
};

const SubsidyTiles = ({ muted }: SubsidyTilesProps) => {
  const { data: program } = useSubsidyProgram();

  if (!program) {
    return null;
  }

  const limits = program.discount?.windows.filter((window) => !window.unlimited) ?? [];

  return (
    <div className={classNames(styles.tiles, { [styles.tileMuted]: muted })}>
      {program.oneTime ? (
        <Card className={styles.tile} innerShadow="black" radius="sm" variant="glass">
          <span className={styles.tileTitle}>
            <span className={classNames(toneStyles.dot, toneStyles.credit)} />
            Free credit
          </span>
          <span className={styles.bigValue}>
            {formatSubsidyAmount(program.oneTime.credit)}
            <span className={styles.bigUnit}>{SUBSIDY_TOKEN_SYMBOL}</span>
          </span>
          <span className={styles.tileNote}>
            Use across jobs until it runs out
            {program.oneTime.percent < 100 ? `, ${formatSubsidyAmount(program.oneTime.percent)}% of each job` : ''}
          </span>
        </Card>
      ) : null}
      {program.discount ? (
        <Card className={styles.tile} innerShadow="black" radius="sm" variant="glass">
          <span className={styles.tileTitle}>
            <span className={classNames(toneStyles.dot, toneStyles.discount)} />
            Discount on each job
          </span>
          <span className={styles.bigValue}>{formatSubsidyAmount(program.discount.percent)}% off</span>
          {limits.length > 0 ? (
            <div className={styles.tileLimits}>
              {limits.map((window) => (
                <div className={styles.tileLimit} key={window.periodSeconds}>
                  <span>
                    Up to {formatSubsidyAmount(window.limit)} {SUBSIDY_TOKEN_SYMBOL}
                  </span>
                  <span>each {formatSubsidyPeriod(window.periodSeconds)}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className={styles.tileNote}>No limit</span>
          )}
        </Card>
      ) : null}
    </div>
  );
};

export default SubsidyTiles;
