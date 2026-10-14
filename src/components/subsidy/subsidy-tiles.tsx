import Card from '@/components/card/card';
import { formatSubsidyAmount, getDiscountLimitsLabel } from '@/components/subsidy/subsidy-copy';
import { SUBSIDY_TOKEN_SYMBOL } from '@/constants/subsidy';
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

  const limits = getDiscountLimitsLabel(program);

  return (
    <div className={classNames(styles.tiles, { [styles.tileMuted]: muted })}>
      {program.oneTime ? (
        <Card className={styles.tile} radius="sm" variant={muted ? 'glass' : 'accent1-outline'}>
          <span className={styles.tileLabel}>{muted ? 'On us once claimed, one time' : 'On us, one time'}</span>
          <span className={styles.bigValue}>
            {formatSubsidyAmount(program.oneTime.credit)}
            <span className={styles.bigUnit}>{SUBSIDY_TOKEN_SYMBOL}</span>
          </span>
        </Card>
      ) : null}
      {program.discount ? (
        <Card className={styles.tile} radius="sm" variant={muted ? 'glass' : 'accent1-outline'}>
          <span className={styles.tileLabel}>Off each job{limits ? `, ${limits}` : ''}</span>
          <span className={styles.bigValue}>{formatSubsidyAmount(program.discount.percent)}%</span>
        </Card>
      ) : null}
    </div>
  );
};

export default SubsidyTiles;
