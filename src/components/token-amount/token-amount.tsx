import { formatTokenAmount } from '@/utils/formatters';
import classNames from 'classnames';
import styles from './token-amount.module.css';

type TokenAmountProps = {
  amount: number;
  className?: string;
  error?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tokenAddress: string;
  tokenSymbol: string;
};

const TokenAmount = ({ amount, className, error, size = 'lg', tokenAddress, tokenSymbol }: TokenAmountProps) => (
  <div className={classNames(styles.values, styles[size], className)}>
    <span className={styles.token}>{tokenSymbol}</span>
    &nbsp;
    <span className={classNames(styles.amount, { textError: error })}>{formatTokenAmount(amount, tokenAddress)}</span>
  </div>
);

export default TokenAmount;
