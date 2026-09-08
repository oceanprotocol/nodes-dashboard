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

/**
 * Billable minutes for a paid compute/service window, mirroring ocean-node's
 * `calculateResourcesCost`: the requested duration is floored at the environment's
 * `minJobDuration` and then billed in WHOLE minutes, rounded up.
 *
 *   node: if (duration < env.minJobDuration) duration = env.minJobDuration
 *         cost += price * amount * Math.ceil(duration / 60)
 *
 * Client-side pricing must use exactly this formula. Quoting a plain `seconds / 60`
 * under-quotes any window shorter than `minJobDuration` (or not a whole number of
 * minutes), so the escrow deposit sized from that quote is too small and the node's
 * `createLock` reverts with "does not have enough funds".
 */
export function billableMinutes(durationSeconds: number, minJobDurationSeconds = 0): number {
  return Math.ceil(Math.max(durationSeconds, minJobDurationSeconds) / 60);
}
