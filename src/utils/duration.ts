import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export type DurationUnit = 'seconds' | 'minutes' | 'hours';

export const DURATION_UNIT_OPTIONS: { label: string; value: DurationUnit }[] = [
  { label: 'sec', value: 'seconds' },
  { label: 'min', value: 'minutes' },
  { label: 'hrs', value: 'hours' },
];

export function toSeconds(value: number, unit: DurationUnit): number {
  return dayjs.duration(value, unit).asSeconds();
}

export function fromSeconds(seconds: number, unit: DurationUnit): number {
  const value = dayjs.duration(seconds, 'seconds').as(unit);
  return unit === 'hours' ? Math.ceil(value) : value;
}
