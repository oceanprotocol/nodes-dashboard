import {
  formatSubsidyAmount,
  formatSubsidyTokenAmount,
  getDiscountLimitsLabel,
} from '@/components/subsidy/subsidy-copy';
import { useSubsidyProgram } from '@/lib/use-subsidy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Tooltip } from '@mui/material';
import { useState } from 'react';
import styles from './subsidy.module.css';

const EXAMPLE_JOB_COST = 20;

const SubsidyInfoButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: program } = useSubsidyProgram();

  if (!program) {
    return null;
  }

  const { discount, oneTime } = program;
  const limits = getDiscountLimitsLabel(program);

  const info = (
    <div className={styles.info}>
      <span className={styles.infoTitle}>How your subsidy works</span>
      {oneTime ? (
        <span>
          <strong>{formatSubsidyTokenAmount(oneTime.credit)} on us.</strong>{' '}
          {oneTime.percent >= 100
            ? `Your first ${formatSubsidyTokenAmount(oneTime.credit)} of jobs and services are free.`
            : `${formatSubsidyAmount(oneTime.percent)}% of each job is covered until ${formatSubsidyTokenAmount(oneTime.credit)} is used.`}{' '}
        </span>
      ) : null}
      {discount ? (
        <span>
          <strong>{formatSubsidyAmount(discount.percent)}% off.</strong> {oneTime ? 'After that, the' : 'The'} subsidy
          pays {formatSubsidyAmount(discount.percent)}% of each job or service{limits ? `, ${limits}` : ''}. A{' '}
          {formatSubsidyTokenAmount(EXAMPLE_JOB_COST)} job costs you{' '}
          {formatSubsidyTokenAmount((EXAMPLE_JOB_COST * (100 - discount.percent)) / 100)}.
          {oneTime
            ? ` If the ${formatSubsidyTokenAmount(oneTime.credit)} covers only part of a job, the rest gets the discount.`
            : ''}
        </span>
      ) : null}
      <span>Paid up front when a job starts, so you only need your part in escrow.</span>
    </div>
  );

  return (
    <Tooltip
      enterTouchDelay={0}
      leaveTouchDelay={8000}
      onClose={() => setIsOpen(false)}
      onOpen={() => setIsOpen(true)}
      open={isOpen}
      title={info}
    >
      <button
        aria-expanded={isOpen}
        aria-label="How your subsidy works"
        className={styles.infoButton}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <InfoOutlinedIcon fontSize="small" />
      </button>
    </Tooltip>
  );
};

export default SubsidyInfoButton;
