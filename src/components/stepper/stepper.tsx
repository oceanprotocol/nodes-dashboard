import Card from '@/components/card/card';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import classNames from 'classnames';
import { Fragment, useMemo } from 'react';
import styles from './stepper.module.css';

export type Step<T> = {
  hidden?: boolean;
  key: T;
  label: string;
};

type StepperProps<T> = {
  currentStep: T;
  steps: Step<T>[];
};

const Stepper = <T extends string>({ currentStep, steps }: StepperProps<T>) => {
  const visibleSteps = useMemo(() => steps.filter((step) => !step.hidden), [steps]);

  const currentStepIndex = useMemo(
    () => visibleSteps.findIndex((step) => step.key === currentStep),
    [currentStep, visibleSteps]
  );

  const renderStep = (step: Step<T>, index: number) => {
    const isActive = currentStepIndex === index;
    const isComplete = currentStepIndex > index;
    return (
      <Fragment key={step.key}>
        {index > 0 ? (
          <div className={classNames(styles.separator, { [styles.active]: isActive || isComplete })}>—</div>
        ) : null}
        <div className={classNames(styles.step, { [styles.active]: isActive, [styles.complete]: isComplete })}>
          {isComplete ? <CheckCircleOutlineIcon /> : null}
          {step.label}
        </div>
      </Fragment>
    );
  };

  return (
    <Card className={styles.root} variant="glass-shaded">
      {visibleSteps.map((step, index) => (
        <Fragment key={step.key}>{renderStep(step, index)}</Fragment>
      ))}
    </Card>
  );
};

export default Stepper;
