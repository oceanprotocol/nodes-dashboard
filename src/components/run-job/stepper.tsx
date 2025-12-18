import Card from '@/components/card/card';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import classNames from 'classnames';
import styles from './stepper.module.css';

type StepperProps = {
  currentStep: 1 | 2 | 3 | 4;
  freeCompute: boolean;
};

const Stepper = ({ currentStep, freeCompute }: StepperProps) => {
  const renderStep = (number: number, label: string, separatorBefore: boolean) => {
    const isActive = currentStep === number;
    const isComplete = currentStep > number;
    return (
      <>
        {separatorBefore ? (
          <div className={classNames(styles.separator, { [styles.active]: isActive || isComplete })}>—</div>
        ) : null}
        <div className={classNames(styles.step, { [styles.active]: isActive, [styles.complete]: isComplete })}>
          {isComplete ? <CheckCircleOutlineIcon /> : null}
          {label}
        </div>
      </>
    );
  };

  return (
    <Card className={styles.root} variant="glass-shaded">
      {renderStep(1, 'Environment', false)}
      {renderStep(2, 'Resources', true)}
      {freeCompute ? null : renderStep(3, 'Payment', true)}
      {renderStep(4, 'Finish', true)}
    </Card>
  );
};

export default Stepper;
