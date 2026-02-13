import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './two-factor-input.module.css';

type TwoFactorInputProps = {
  name?: string;
  onChange: (value: string, name?: string) => void;
  value: string;
};

const TwoFactorInput: React.FC<TwoFactorInputProps> = ({ name, onChange, value }) => {
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const crtIndex = value ? value.length : 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const inputValue = e.currentTarget.value;
    if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(inputValue)) {
      onChange(value + inputValue, name);
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        setTimeout(() => {
          nextInput.focus();
        }, 0);
      }
    } else if (!inputValue) {
      onChange(value.slice(0, -1), name);
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) {
        setTimeout(() => {
          prevInput.focus();
        }, 0);
      }
    }
  };

  useEffect(() => {
    const crtInput = inputRefs.current[crtIndex];
    if (crtInput) {
      crtInput.focus();
    }
  }, [crtIndex]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const isInputDisabled = (inputIndex: number) => {
    if (inputIndex === crtIndex) {
      return false;
    }
    if (inputIndex === 5 && value.length === 6) {
      return false;
    }
    return true;
  };

  const handleBackspace = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        onChange(value.slice(0, -1), name);
      }
    },
    [name, onChange, value]
  );

  useEffect(() => {
    if (isFocused) {
      document.addEventListener('keydown', handleBackspace);
    } else {
      document.removeEventListener('keydown', handleBackspace);
    }
    return () => {
      document.removeEventListener('keydown', handleBackspace);
    };
  }, [handleBackspace, isFocused]);

  const inputs = Array.from({ length: 6 }).map((_, index) => (
    <input
      key={index}
      className={styles.input}
      data-index={index}
      disabled={isInputDisabled(index)}
      onBlur={handleBlur}
      onChange={(e) => handleChange(e, index)}
      onFocus={handleFocus}
      ref={(el) => {
        inputRefs.current[index] = el;
      }}
      type="text"
      value={value[index] ?? ''}
    />
  ));

  return (
    <div className={styles.root}>
      <div className={styles.half}>{inputs.slice(0, 3)}</div>
      <div className={styles.half}>{inputs.slice(3)}</div>
    </div>
  );
};

export default TwoFactorInput;
