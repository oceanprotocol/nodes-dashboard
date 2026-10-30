import CheckIcon from '@mui/icons-material/Check';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import classNames from 'classnames';
import styles from './flow-steps.module.css';

export type FlowStepStatus = 'attention' | 'complete';

export type FlowStep = {
  title: string;
  description: string;
  status?: FlowStepStatus;
};

type FlowStepsProps = {
  steps: FlowStep[];
  title?: string;
};

const FlowSteps: React.FC<FlowStepsProps> = ({ steps, title = 'How it works' }) => {
  return (
    <section aria-label={title} className={styles.root}>
      <ol className={styles.steps} style={{ '--steps-count': steps.length } as React.CSSProperties}>
        {steps.map((step, index) => (
          <li className={classNames(styles.step, step.status && styles[step.status])} key={step.title}>
            <span aria-hidden className={styles.marker}>
              {step.status === 'complete' ? (
                <CheckIcon />
              ) : step.status === 'attention' ? (
                <PriorityHighIcon />
              ) : (
                index + 1
              )}
            </span>
            <div className={styles.stepBody}>
              <h4 className={styles.stepTitle}>{step.title}</h4>
              <p className={styles.stepDescription}>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default FlowSteps;
