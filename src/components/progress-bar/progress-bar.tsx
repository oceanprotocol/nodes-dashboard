import { LinearProgress, Tooltip, styled } from '@mui/material';
import classNames from 'classnames';
import styles from './progress-bar.module.css';

const StyledLinearProgress = styled(LinearProgress)({
  background: 'var(--background-glass-secondary)',
  border: '2px solid var(--background-glass-secondary)',
  borderRadius: 8,
  height: 16,
  '& .MuiLinearProgress-bar': {
    borderRadius: 8,
  },
});

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export type ProgressBarMarker = {
  title?: string;
  value: number;
};

type ProgressBarProps = {
  className?: string;
  topLeftContent?: React.ReactNode;
  topRightContent?: React.ReactNode;
  bottomLeftContent?: React.ReactNode;
  bottomRightContent?: React.ReactNode;
  /** A second value drawn as a tick on the track, on the same 0-100 scale as `value`, with optional
   * hover text. What it means is the caller's business — a session peak, a target, a threshold, a
   * previous reading. Shorthand for a single-entry `markers`. */
  marker?: ProgressBarMarker;
  /** Several ticks on one track, all drawn identically — what each one means comes from its hover
   * text, so keep the count low enough that the reader can hover them apart. */
  markers?: ProgressBarMarker[];
  value?: number;
  variant?: 'determinate' | 'indeterminate';
};

const ProgressBar = ({
  className,
  topLeftContent,
  topRightContent,
  bottomLeftContent,
  bottomRightContent,
  marker,
  markers,
  value = 0,
  variant = 'determinate',
}: ProgressBarProps) => {
  const ticks = markers ?? (marker ? [marker] : []);
  return (
    <div className={classNames(styles.root, className)}>
      {topLeftContent || topRightContent ? (
        <div className={styles.row}>
          <div>{topLeftContent}</div>
          <div>{topRightContent}</div>
        </div>
      ) : null}
      <div className={styles.track}>
        <StyledLinearProgress value={variant === 'determinate' ? value : undefined} variant={variant} />
        {variant === 'determinate'
          ? ticks.map((tick, index) => (
              <Tooltip key={`${index}-${tick.value}`} title={tick.title ?? ''}>
                <div className={styles.marker} style={{ left: `${clampPercent(tick.value)}%` }} />
              </Tooltip>
            ))
          : null}
      </div>
      {bottomLeftContent || bottomRightContent ? (
        <div className={styles.row}>
          <div>{bottomLeftContent}</div>
          <div>{bottomRightContent}</div>
        </div>
      ) : null}
    </div>
  );
};

export default ProgressBar;
