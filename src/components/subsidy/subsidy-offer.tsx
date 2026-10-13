import Card from '@/components/card/card';
import { CHAIN_ID, CHAIN_LABELS } from '@/constants/chains';
import {
  SUBSIDY_DISCOUNT_PERCENT,
  SUBSIDY_ONE_TIME_CREDIT,
  SUBSIDY_TOKEN_SYMBOL,
  SUBSIDY_WEEKLY_DISCOUNT_LIMIT,
} from '@/constants/subsidy';
import styles from './subsidy.module.css';

const SubsidyOffer = () => (
  <Card className={styles.offer} radius="sm" variant="accent1-outline">
    <span className={styles.offerTitle}>OPF subsidy</span>
    <span className="chip chipAccent2">
      {SUBSIDY_ONE_TIME_CREDIT} {SUBSIDY_TOKEN_SYMBOL} on us
    </span>
    <span className="chip chipAccent2">
      {SUBSIDY_DISCOUNT_PERCENT}% discount, up to {SUBSIDY_WEEKLY_DISCOUNT_LIMIT} {SUBSIDY_TOKEN_SYMBOL} / week
    </span>
    <span className={styles.offerNote}>
      Jobs and inference on subsidized nodes · {SUBSIDY_TOKEN_SYMBOL} on {CHAIN_LABELS[CHAIN_ID]}
    </span>
  </Card>
);

export default SubsidyOffer;
