import Card from '@/components/card/card';
import { getDiscountLabel, getDiscountLimitsLabel, getOneTimeLabel } from '@/components/subsidy/subsidy-copy';
import { CHAIN_ID, CHAIN_LABELS } from '@/constants/chains';
import { SUBSIDY_TOKEN_SYMBOL } from '@/constants/subsidy';
import { useSubsidyProgram } from '@/lib/use-subsidy';
import styles from './subsidy.module.css';

const SubsidyOffer = () => {
  const { data: program } = useSubsidyProgram();

  const oneTimeLabel = program ? getOneTimeLabel(program) : null;
  const discountLabel = program
    ? [getDiscountLabel(program), getDiscountLimitsLabel(program)].filter(Boolean).join(', ')
    : null;

  return (
    <Card className={styles.offer} radius="sm" variant="accent1-outline">
      <span className={styles.offerTitle}>OPF subsidy</span>
      {oneTimeLabel ? <span className="chip chipAccent2">{oneTimeLabel}</span> : null}
      {discountLabel ? <span className="chip chipAccent2">{discountLabel}</span> : null}
      <span className={styles.offerNote}>
        Jobs and inference on subsidized nodes · {SUBSIDY_TOKEN_SYMBOL} on {CHAIN_LABELS[CHAIN_ID]}
      </span>
    </Card>
  );
};

export default SubsidyOffer;
