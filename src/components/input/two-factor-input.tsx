import classNames from 'classnames';
import { useEffect, useRef } from 'react';
import styles from './two-factor-input.module.css';

const CODE_LENGTH = 6;

type TwoFactorInputProps = {
  'aria-label'?: string;
  disabled?: boolean;
  /** Marks every box as wrong. The next keystroke starts a fresh code. */
  error?: boolean;
  name?: string;
  onChange: (value: string, name?: string) => void;
  value: string;
};

const TwoFactorInput: React.FC<TwoFactorInputProps> = ({
  'aria-label': ariaLabel,
  disabled,
  error,
  name,
  onChange,
  value,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const crtIndex = Math.min(value.length, CODE_LENGTH - 1);

  useEffect(() => {
    if (disabled) {
      return;
    }
    const crtInput = inputRefs.current[crtIndex];
    if (crtInput && document.activeElement !== crtInput) {
      crtInput.focus();
    }
    if (crtInput && error) {
      crtInput.select();
    }
  }, [crtIndex, disabled, error]);

  // Typing and pasting both land here: a pasted code fills every box from the one it lands in.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const digits = e.currentTarget.value.replace(/\D/g, '');
    if (!digits) {
      return;
    }
    if (error) {
      onChange(digits.slice(-CODE_LENGTH), name);
      return;
    }
    const typed = digits.length > 1 && index < value.length ? digits.slice(-1) : digits;
    onChange((value.slice(0, index) + typed).slice(0, CODE_LENGTH), name);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key !== 'Backspace') {
      return;
    }
    e.preventDefault();
    if (error) {
      onChange('', name);
      return;
    }
    const removeAt = index < value.length ? index : index - 1;
    if (removeAt >= 0) {
      onChange(value.slice(0, removeAt), name);
    }
  };

  const inputs = Array.from({ length: CODE_LENGTH }).map((_, index) => (
    <input
      aria-invalid={error || undefined}
      aria-label={`Digit ${index + 1}`}
      autoComplete={index === 0 ? 'one-time-code' : 'off'}
      className={classNames(styles.input, { [styles.inputError]: error })}
      data-index={index}
      disabled={disabled || index !== crtIndex}
      inputMode="numeric"
      key={index}
      onChange={(e) => handleChange(e, index)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => handleKeyDown(e, index)}
      ref={(el) => {
        inputRefs.current[index] = el;
      }}
      type="text"
      value={value[index] ?? ''}
    />
  ));

  return (
    <div aria-label={ariaLabel} className={classNames(styles.root, { [styles.disabled]: disabled })} role="group">
      <div className={styles.half}>{inputs.slice(0, 3)}</div>
      <div className={styles.half}>{inputs.slice(3)}</div>
    </div>
  );
};

export default TwoFactorInput;
