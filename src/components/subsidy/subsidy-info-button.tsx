import {
  SUBSIDY_DISCOUNT_PERCENT,
  SUBSIDY_ONE_TIME_CREDIT,
  SUBSIDY_TOKEN_SYMBOL,
  SUBSIDY_WEEKLY_DISCOUNT_LIMIT,
} from '@/constants/subsidy';
import { formatSubsidyReset, getNextWeeklyReset } from '@/lib/use-subsidy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Tooltip } from '@mui/material';
import { useState } from 'react';
import styles from './subsidy.module.css';

const EXAMPLE_JOB_COST = 20;

const SubsidyInfoButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  const info = (
    <div className={styles.info}>
      <span className={styles.infoTitle}>How your subsidy works</span>
      <span>
        <strong>
          {SUBSIDY_ONE_TIME_CREDIT} {SUBSIDY_TOKEN_SYMBOL} on us.
        </strong>{' '}
        Your first {SUBSIDY_ONE_TIME_CREDIT} {SUBSIDY_TOKEN_SYMBOL} of jobs and services are free. One time.
      </span>
      <span>
        <strong>{SUBSIDY_DISCOUNT_PERCENT}% discount.</strong> After that, you pay half of each job or service, up to{' '}
        {SUBSIDY_WEEKLY_DISCOUNT_LIMIT} {SUBSIDY_TOKEN_SYMBOL} of discount a week. A {EXAMPLE_JOB_COST}{' '}
        {SUBSIDY_TOKEN_SYMBOL} job costs you {(EXAMPLE_JOB_COST * (100 - SUBSIDY_DISCOUNT_PERCENT)) / 100}{' '}
        {SUBSIDY_TOKEN_SYMBOL}. If the {SUBSIDY_ONE_TIME_CREDIT} {SUBSIDY_TOKEN_SYMBOL} covers only part of a job, the
        rest gets the {SUBSIDY_DISCOUNT_PERCENT}% discount.
      </span>
      <span className={styles.infoNote}>
        Both are paid up front when a job starts, so you only need your part in escrow. The week resets{' '}
        {formatSubsidyReset(getNextWeeklyReset())}.
      </span>
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
