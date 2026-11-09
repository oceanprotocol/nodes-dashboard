import Button from '@/components/button/button';
import Input from '@/components/input/input';
import { type DurationUnit, fromSeconds, toSeconds } from '@/utils/duration';
import cx from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import styles from './duration-input.module.css';

type DurationUnitOption = {
  label: string;
  value: DurationUnit;
};

type DurationInputProps = {
  ariaLabel?: string;
  availableUnits: DurationUnitOption[];
  className?: string;
  defaultUnit?: DurationUnit;
  disabled?: boolean;
  emptyWhenZero?: boolean;
  errorText?: string;
  hint?: React.ReactNode;
  invalid?: boolean;
  label?: React.ReactNode;
  max?: number; // seconds
  min?: number; // seconds
  name?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onChange: (seconds: number) => void;
  onSetMax?: () => void;
  placeholder?: string;
  radius?: number;
  size?: 'sm' | 'md';
  topRight?: React.ReactNode;
  /** `auto`: segmented on wide screens, a select on narrow ones where the segments would crowd out the value. */
  unitControl?: 'auto' | 'select' | 'segmented';
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
  ariaLabel,
  availableUnits,
  className,
  defaultUnit = 'seconds',
  disabled,
  emptyWhenZero,
  errorText,
  hint,
  invalid,
  label,
  max,
  min,
  name,
  onBlur,
  onChange,
  onSetMax,
  placeholder,
  radius,
  size,
  topRight,
  unitControl = 'select',
  value,
}) => {
  const [unit, setUnit] = useState<DurationUnit>(() => unitShowing(value, defaultUnit, availableUnits));
  const [displayValue, setDisplayValue] = useState<number | ''>(() =>
    emptyWhenZero && value === 0 ? '' : displayIn(value, unitShowing(value, defaultUnit, availableUnits))
  );
  const sentSecondsRef = useRef<number>(value);

  useEffect(() => {
    if (value !== sentSecondsRef.current) {
      sentSecondsRef.current = value;
      const nextUnit = emptyWhenZero && value === 0 ? defaultUnit : unitShowing(value, unit, availableUnits);
      setUnit(nextUnit);
      setDisplayValue(emptyWhenZero && value === 0 ? '' : displayIn(value, nextUnit));
    }
  }, [value, unit, availableUnits, emptyWhenZero, defaultUnit]);

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

  // Convert the seconds last sent, not the (4-decimal) number on screen. Switching to a bigger unit the
  // duration doesn't read cleanly in rounds it to a whole number of that unit (at least 1).
  const handleUnitChange = (newUnit: DurationUnit) => {
    setUnit(newUnit);
    if (displayValue === '') {
      return;
    }
    const seconds = sentSecondsRef.current;
    const isBiggerUnit = toSeconds(1, newUnit) > toSeconds(1, unit);
    if (isBiggerUnit && seconds > 0 && !readsCleanly(seconds, newUnit)) {
      const rounded = Math.max(1, Math.round(fromSeconds(seconds, newUnit)));
      const roundedSeconds = toSeconds(rounded, newUnit);
      setDisplayValue(rounded);
      sentSecondsRef.current = roundedSeconds;
      onChange(roundedSeconds);
      return;
    }
    setDisplayValue(displayIn(seconds, newUnit));
  };

  return (
    <Input
      ariaLabel={ariaLabel}
      className={className}
      disabled={disabled}
      endAdornment={
        <div className={styles.controls}>
          {unitControl !== 'select' && (
            <div
              aria-label="Duration unit"
              className={cx(styles.unitSegments, unitControl === 'auto' && styles.wideOnly)}
              role="group"
            >
              {availableUnits.map((opt) => (
                <Button
                  aria-label={opt.value}
                  aria-pressed={unit === opt.value}
                  color={unit === opt.value ? 'accent2' : 'primary'}
                  disabled={disabled}
                  key={opt.value}
                  onClick={() => handleUnitChange(opt.value)}
                  size="sm"
                  variant={unit === opt.value ? 'filled' : 'transparent'}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
          {unitControl !== 'segmented' && (
            <select
              aria-label="Duration unit"
              className={cx(styles.unitSelect, unitControl === 'auto' && styles.narrowOnly)}
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
          )}
          {onSetMax ? (
            <Button color="accent2" onClick={onSetMax} size="sm" type="button" variant="filled">
              Set max
            </Button>
          ) : null}
        </div>
      }
      errorText={errorText}
      hint={hint}
      invalid={invalid}
      label={label}
      // Whole units: the native min is the arrow keys' step base, so a fractional one makes them step off-integer.
      max={max !== undefined ? Math.floor(fromSeconds(max, unit)) : undefined}
      min={min !== undefined ? Math.ceil(fromSeconds(min, unit)) : undefined}
      name={name}
      onBlur={onBlur}
      onChange={handleValueChange}
      placeholder={placeholder}
      radius={radius}
      size={size}
      step="any"
      topRight={topRight}
      type="number"
      value={displayValue}
    />
  );
};

export default DurationInput;
