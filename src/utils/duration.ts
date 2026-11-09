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
  return dayjs.duration(seconds, 'seconds').as(unit);
}

/** When a session of `seconds` started now would end: "22:38" today, else "Tue 09:40". */
export function formatSessionEnd(seconds: number): string {
  const now = dayjs();
  const end = now.add(seconds, 'second');
  return end.isSame(now, 'day') ? end.format('HH:mm') : end.format('ddd HH:mm');
}

/** A session length in its largest readable unit: "2 h", "1.5 h", "45 min". */
export function formatSessionLength(seconds: number): string {
  if (seconds >= 3600) {
    return `${Number((seconds / 3600).toFixed(2))} h`;
  }
  if (seconds >= 60) {
    return `${Number((seconds / 60).toFixed(1))} min`;
  }
  return `${seconds} s`;
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
