import Button from '@/components/button/button';
import Input from '@/components/input/input';
import { type DurationUnit, fromSeconds, toSeconds } from '@/utils/duration';
import React, { useEffect, useRef, useState } from 'react';
import styles from './duration-input.module.css';

type DurationUnitOption = {
  label: string;
  value: DurationUnit;
};

type DurationInputProps = {
  availableUnits: DurationUnitOption[];
  defaultUnit?: DurationUnit;
  disabled?: boolean;
  errorText?: string;
  hint?: React.ReactNode;
  label?: React.ReactNode;
  max?: number; // seconds
  min?: number; // seconds
  name?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onChange: (seconds: number) => void;
  onSetMax?: () => void;
  size?: 'sm' | 'md';
  topRight?: React.ReactNode;
  value: number; // seconds
};

const DurationInput: React.FC<DurationInputProps> = ({
  availableUnits,
  defaultUnit = 'seconds',
  disabled,
  errorText,
  hint,
  label,
  max,
  min,
  name,
  onBlur,
  onChange,
  onSetMax,
  size,
  topRight,
  value,
}) => {
  const [unit, setUnit] = useState<DurationUnit>(defaultUnit);
  const [displayValue, setDisplayValue] = useState<number | ''>(fromSeconds(value, defaultUnit));
  const sentSecondsRef = useRef<number>(value);

  useEffect(() => {
    if (value !== sentSecondsRef.current) {
      sentSecondsRef.current = value;
      setDisplayValue(fromSeconds(value, unit));
    }
  }, [value, unit]);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.target.value === '') {
      setDisplayValue('');
      sentSecondsRef.current = 0;
      onChange(0);
      return;
    }
    const num = Math.max(0, Number(e.target.value));
    setDisplayValue(num);
    const seconds = toSeconds(num, unit);
    sentSecondsRef.current = seconds;
    onChange(seconds);
  };

  const handleUnitChange = (newUnit: DurationUnit) => {
    const currentSeconds = toSeconds(Number(displayValue) || 0, unit);
    setUnit(newUnit);
    setDisplayValue(fromSeconds(currentSeconds, newUnit));
  };

  return (
    <Input
      disabled={disabled}
      endAdornment={
        <div className={styles.controls}>
          <select
            aria-label="Duration unit"
            className={styles.unitSelect}
            disabled={disabled}
            onChange={(e) => handleUnitChange(e.target.value as DurationUnit)}
            value={unit}
          >
            {availableUnits.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {onSetMax ? (
            <Button color="accent2" onClick={onSetMax} size="sm" type="button" variant="filled">
              Set max
            </Button>
          ) : null}
        </div>
      }
      errorText={errorText}
      hint={hint}
      label={label}
      max={max !== undefined ? fromSeconds(max, unit) : undefined}
      min={min !== undefined ? fromSeconds(min, unit) : undefined}
      name={name}
      onBlur={onBlur}
      onChange={handleValueChange}
      size={size}
      topRight={topRight}
      type="number"
      value={displayValue}
    />
  );
};

export default DurationInput;
