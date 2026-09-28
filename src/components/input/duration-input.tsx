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
  className?: string;
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
  radius?: number;
  size?: 'sm' | 'md';
  topRight?: React.ReactNode;
  value: number; // seconds
};

/** `seconds` in `unit`, trimmed to 4 decimals for the field (5 s is 0.0014 hrs). Display only. */
const displayIn = (seconds: number, unit: DurationUnit) => Number(fromSeconds(seconds, unit).toFixed(4));

/** Whether `unit` reads `seconds` cleanly: a whole number or a short decimal (1.5 hrs, not 0.1667). */
const readsCleanly = (seconds: number, unit: DurationUnit) => {
  const hundredths = fromSeconds(seconds, unit) * 100;
  return Math.abs(hundredths - Math.round(hundredths)) < 1e-6;
};

/**
 * The unit to show a value set from outside in: `preferred` when it reads cleanly there, else the
 * largest available unit that does (600 s reads as 10 min, not 0.1667 hrs).
 */
function unitShowing(seconds: number, preferred: DurationUnit, units: DurationUnitOption[]): DurationUnit {
  if (readsCleanly(seconds, preferred)) {
    return preferred;
  }
  const clean = [...units].reverse().find((opt) => readsCleanly(seconds, opt.value));
  return clean?.value ?? preferred;
}

const DurationInput: React.FC<DurationInputProps> = ({
  availableUnits,
  className,
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
  radius,
  size,
  topRight,
  value,
}) => {
  const [unit, setUnit] = useState<DurationUnit>(() => unitShowing(value, defaultUnit, availableUnits));
  const [displayValue, setDisplayValue] = useState<number | ''>(() =>
    displayIn(value, unitShowing(value, defaultUnit, availableUnits))
  );
  const sentSecondsRef = useRef<number>(value);

  useEffect(() => {
    if (value !== sentSecondsRef.current) {
      sentSecondsRef.current = value;
      const nextUnit = unitShowing(value, unit, availableUnits);
      setUnit(nextUnit);
      setDisplayValue(displayIn(value, nextUnit));
    }
  }, [value, unit, availableUnits]);

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

  // Switching the unit only changes how the duration reads, never the duration itself: convert the
  // seconds last sent, not the (4-decimal) number on screen.
  const handleUnitChange = (newUnit: DurationUnit) => {
    setUnit(newUnit);
    setDisplayValue(displayValue === '' ? '' : displayIn(sentSecondsRef.current, newUnit));
  };

  return (
    <Input
      className={className}
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
      radius={radius}
      size={size}
      topRight={topRight}
      type="number"
      value={displayValue}
    />
  );
};

export default DurationInput;
