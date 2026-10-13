import Card from '@/components/card/card';
import {
  SUBSIDY_DISCOUNT_PERCENT,
  SUBSIDY_ONE_TIME_CREDIT,
  SUBSIDY_TOKEN_SYMBOL,
  SUBSIDY_WEEKLY_DISCOUNT_LIMIT,
} from '@/constants/subsidy';
import classNames from 'classnames';
import styles from './subsidy.module.css';

type SubsidyTilesProps = {
  /** Not claimed yet and still blocked on an earlier step. */
  muted?: boolean;
};

const SubsidyTiles = ({ muted }: SubsidyTilesProps) => (
  <div className={classNames(styles.tiles, { [styles.tileMuted]: muted })}>
    <Card className={styles.tile} radius="sm" variant={muted ? 'glass' : 'accent1-outline'}>
      <span className={styles.tileLabel}>{muted ? 'On us once claimed, one time' : 'On us, one time'}</span>
      <span className={styles.bigValue}>
        {SUBSIDY_ONE_TIME_CREDIT}
        <span className={styles.bigUnit}>{SUBSIDY_TOKEN_SYMBOL}</span>
      </span>
    </Card>
    <Card className={styles.tile} radius="sm" variant={muted ? 'glass' : 'accent1-outline'}>
      <span className={styles.tileLabel}>
        Discount on each job, up to {SUBSIDY_WEEKLY_DISCOUNT_LIMIT} {SUBSIDY_TOKEN_SYMBOL} / week
      </span>
      <span className={styles.bigValue}>{SUBSIDY_DISCOUNT_PERCENT}%</span>
    </Card>
  </div>
);

export default SubsidyTiles;
