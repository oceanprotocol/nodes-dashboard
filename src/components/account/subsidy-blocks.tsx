import Card from '@/components/card/card';
import { formatSubsidyAmount, formatSubsidyTokenAmount } from '@/components/subsidy/subsidy-copy';
import toneStyles from '@/components/subsidy/subsidy-tone.module.css';
import { formatSubsidyPeriod, formatSubsidyReset, SubsidyAllowance, SubsidyWindow } from '@/lib/subsidy';
import classNames from 'classnames';
import { ReactNode } from 'react';
import styles from './subsidy-section.module.css';

export type Tone = 'credit' | 'custom' | 'discount';

type MeterProps = {
  className?: string;
  limit: number;
  remaining: number;
  tone: Tone;
};

const Meter = ({ className, limit, remaining, tone }: MeterProps) => (
  <div className={classNames(styles.meter, className)}>
    <div
      className={classNames(styles.meterFill, toneStyles[tone])}
      style={{ width: `${limit > 0 ? Math.min(100, (remaining / limit) * 100) : 0}%` }}
    />
  </div>
);

type BlockHeaderProps = {
  action?: ReactNode;
  caption?: ReactNode;
  subtitle?: string;
  title: string;
  tone?: Tone;
};

export const BlockHeader = ({ action, caption, subtitle, title, tone }: BlockHeaderProps) => (
  <div className={styles.blockHeaderRow}>
    <div className={styles.blockHeaderText}>
      <div className={styles.blockHeader}>
        {tone ? <span className={classNames(toneStyles.dot, toneStyles[tone])} /> : null}
        <strong>{title}</strong>
        {subtitle ? <span className={styles.small}>{subtitle}</span> : null}
      </div>
      {caption}
    </div>
    {action ? <div className={styles.blockHeaderAction}>{action}</div> : null}
  </div>
);

const formatLeft = (remaining: number, limit: number) =>
  `${formatSubsidyAmount(remaining)} / ${formatSubsidyTokenAmount(limit)}`;

type BlockProps = Pick<BlockHeaderProps, 'action' | 'caption' | 'tone'> & {
  children?: ReactNode;
};

type CreditBlockProps = BlockProps & {
  allowance: SubsidyAllowance;
  percent: number;
};

export const CreditBlock = ({ action, allowance, caption, children, percent, tone = 'credit' }: CreditBlockProps) => (
  <Card className={styles.block} innerShadow="black" radius="sm" variant="glass">
    <BlockHeader
      action={action}
      caption={caption}
      subtitle={percent < 100 ? `${formatSubsidyAmount(percent)}% of each job` : undefined}
      title="Free credit"
      tone={tone}
    />
    <span className={styles.limitsHead}>Use across jobs until it runs out</span>
    <div className={styles.creditRow}>
      <Meter limit={allowance.limit} remaining={allowance.remaining} tone={tone} />
      <span className={styles.amount}>
        {allowance.remaining > 0 ? formatLeft(allowance.remaining, allowance.limit) : 'Used up'}
      </span>
    </div>
    {children}
  </Card>
);

type DiscountBlockProps = BlockProps & {
  percent: number;
  windows: SubsidyWindow[];
};

export const DiscountBlock = ({
  action,
  caption,
  children,
  percent,
  tone = 'discount',
  windows,
}: DiscountBlockProps) => {
  const capped = windows.filter((window) => !window.unlimited);

  return (
    <Card className={styles.block} innerShadow="black" radius="sm" variant="glass">
      <BlockHeader
        action={action}
        caption={caption}
        subtitle={capped.length === 0 ? 'No limit' : undefined}
        title={`${formatSubsidyAmount(percent)}% off`}
        tone={tone}
      />
      {capped.length > 0 ? (
        <div className={styles.limits}>
          <div className={classNames(styles.limitRow, styles.limitsHead)}>
            <span>Limit</span>
            <span />
            <span>Left</span>
            <span>Resets</span>
          </div>
          {capped.map((window) => (
            <div className={styles.limitRow} key={window.periodSeconds}>
              <span className={styles.limitLabel}>Each {formatSubsidyPeriod(window.periodSeconds)}</span>
              <Meter className={styles.limitMeter} limit={window.limit} remaining={window.remaining} tone={tone} />
              <span className={classNames(styles.amount, styles.limitAmount)}>
                {formatLeft(window.remaining, window.limit)}
              </span>
              <span className={classNames(styles.small, styles.limitReset)}>
                <span className={styles.resetPrefix}>Resets </span>
                {window.resetsAt ? formatSubsidyReset(window.resetsAt) : '—'}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {children}
    </Card>
  );
};
