import { SUBSIDY_PAYMENT_COPY } from '@/components/subsidy/subsidy-copy';
import { SubsidyPayment } from '@/lib/subsidy';
import { Tooltip } from '@mui/material';
import classNames from 'classnames';
import styles from './subsidy.module.css';

type SubsidyPaymentChipsProps = {
  payments: SubsidyPayment[];
};

const SubsidyPaymentChips = ({ payments }: SubsidyPaymentChipsProps) => (
  <>
    {payments.map((payment) => (
      <Tooltip enterTouchDelay={0} key={payment} leaveTouchDelay={8000} title={SUBSIDY_PAYMENT_COPY[payment].tooltip}>
        <span className={classNames('chip', 'chipGlass', styles.smallChip)} tabIndex={0}>
          {SUBSIDY_PAYMENT_COPY[payment].label}
        </span>
      </Tooltip>
    ))}
  </>
);

export default SubsidyPaymentChips;
