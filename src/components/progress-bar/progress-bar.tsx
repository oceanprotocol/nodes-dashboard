import { LinearProgress, styled } from '@mui/material';
import classNames from 'classnames';
import styles from './progress-bar.module.css';

const StyledLinearProgress = styled(LinearProgress)({
  background: 'var(--background-glass)',
  border: '2px solid var(--background-glass)',
  borderRadius: 8,
  height: 16,
  '& .MuiLinearProgress-bar': {
    borderRadius: 8,
  },
});

type ProgressBarProps = {
  className?: string;
  topLeftContent?: React.ReactNode;
  topRightContent?: React.ReactNode;
  bottomLeftContent?: React.ReactNode;
  bottomRightContent?: React.ReactNode;
  value: number;
};

const ProgressBar = ({
  className,
  topLeftContent,
  topRightContent,
  bottomLeftContent,
  bottomRightContent,
  value,
}: ProgressBarProps) => {
  return (
    <div className={classNames(styles.root, className)}>
      {topLeftContent || topRightContent ? (
        <div className={styles.row}>
          <div>{topLeftContent}</div>
          <div>{topRightContent}</div>
        </div>
      ) : null}
      <StyledLinearProgress value={value} variant="determinate" />
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
