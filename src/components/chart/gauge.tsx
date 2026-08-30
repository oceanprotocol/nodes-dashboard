import { formatNumber } from '@/utils/formatters';
import Tooltip from '@mui/material/Tooltip';
import cx from 'classnames';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import styles from './gauge.module.css';

type GaugeProps = {
  centerLabel?: string;
  centerValue?: number;
  label?: string;
  max: number;
  min: number;
  /** ReactNode so callers can pair the name with an icon (see the resource usage panel). */
  title: React.ReactNode;
  value: number;
  valueSuffix?: string;
  /**
   * `small` (~176×88) and `compact` (~150×80) shrink the arc, heading and center value text — for
   * dense layouts (the resource usage panel's page and modal grids respectively). Omit for today's
   * ~220×110 rendering, unchanged.
   */
  size?: 'default' | 'small' | 'compact';
  /**
   * Arc color. `accent1` (the default) and `accent2` are flat brand colors — for a gauge whose value
   * carries no notion of "bad" (revenue, job counts). `range` reads the value as a saturation level
   * and colors it `--success` / `--warning` / `--error` against `warnAt`/`dangerAt`, so a healthy
   * reading is green rather than merely not-red.
   */
  color?: 'accent1' | 'accent2' | 'range';
  /** Value at/above which the arc turns `--warning`. Omit to keep the arc at its base `color` always. */
  warnAt?: number;
  /** Value at/above which the arc turns `--error` — takes precedence over `warnAt`. */
  dangerAt?: number;
  /**
   * Highest value seen (e.g. client-side history max), drawn as a thin tick on the arc. Omit (the
   * default) to draw no tick at all — existing callers are unaffected.
   */
  peak?: number;
  /** Tooltip suffix shown next to the peak tick, e.g. "peak 94%". Ignored when `peak` is omitted. */
  peakLabel?: string;
};

const Gauge = ({
  centerLabel,
  centerValue,
  label,
  max,
  min,
  title,
  value,
  valueSuffix,
  size = 'default',
  color = 'accent1',
  warnAt,
  dangerAt,
  peak,
  peakLabel,
}: GaugeProps) => {
  const isOverMax = value > max;
  const clampedValue = Math.min(value, max);
  const displayCenterValue = centerValue !== undefined ? centerValue : value;

  // Severity color: danger outranks warn, then the base color for the chosen palette. `range` makes
  // the healthy band green; the flat palettes keep their brand color until a threshold trips.
  const baseColor = color === 'range' ? 'var(--success)' : color === 'accent2' ? 'var(--accent2)' : 'var(--accent1)';
  const arcColor =
    dangerAt !== undefined && value >= dangerAt
      ? 'var(--error)'
      : warnAt !== undefined && value >= warnAt
        ? 'var(--warning)'
        : baseColor;

  const slices = useMemo(() => {
    const offsetValue = clampedValue - min;
    const offsetMax = max - clampedValue;
    return [
      { value: offsetValue, color: arcColor },
      {
        value: offsetMax === min ? min + 1 : offsetMax,
        color: 'var(--background-glass-secondary)',
      },
    ];
  }, [max, min, clampedValue, arcColor]);

  // A thin marker slice overlaid on the same band as `slices`, drawn after it (so it paints on top):
  // a narrow colored wedge at the peak position, transparent everywhere else. Skipped when `peak` is
  // outside [min, max] would clamp to an edge, so callers should omit `peak` rather than pass a stale one.
  const peakSlices = useMemo(() => {
    if (peak === undefined || max <= min) {
      return null;
    }
    const clampedPeak = Math.min(Math.max(peak, min), max);
    const total = max - min;
    const tickWidth = total * 0.012;
    const before = Math.max(0, clampedPeak - min - tickWidth / 2);
    const after = Math.max(0, total - before - tickWidth);
    return [
      { value: before, color: 'transparent' },
      { value: tickWidth, color: 'var(--text-secondary)' },
      { value: after, color: 'transparent' },
    ];
  }, [peak, min, max]);

  const tooltipContent = `${formatNumber(value)}${valueSuffix || ''}${isOverMax ? ' (over range)' : ''}${
    peakSlices ? ` · peak ${peakLabel ?? `${formatNumber(peak as number)}${valueSuffix || ''}`}` : ''
  }`;

  return (
    <div
      className={cx(styles.root, {
        [styles.rootSmall]: size === 'small',
        [styles.rootCompact]: size === 'compact',
      })}
    >
      <h3 className={styles.heading}>{title}</h3>
      <div
        className={cx(styles.chartWrapper, {
          [styles.chartWrapperSmall]: size === 'small',
          [styles.chartWrapperCompact]: size === 'compact',
        })}
      >
        <Tooltip arrow placement="top" title={tooltipContent}>
          <div
            className={cx(styles.chart, {
              [styles.chartSmall]: size === 'small',
              [styles.chartCompact]: size === 'compact',
            })}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <Pie
                  cy="100%"
                  data={slices}
                  endAngle={0}
                  innerRadius={'140%'}
                  outerRadius={'200%'}
                  startAngle={180}
                  stroke="none"
                >
                  {slices.map((entry, index) => (
                    <Cell fill={entry.color} key={`cell-${index}`} stroke="none" />
                  ))}
                </Pie>
                {peakSlices && (
                  <Pie
                    cy="100%"
                    data={peakSlices}
                    endAngle={0}
                    innerRadius={'140%'}
                    outerRadius={'200%'}
                    startAngle={180}
                    stroke="none"
                  >
                    {peakSlices.map((entry, index) => (
                      <Cell fill={entry.color} key={`peak-cell-${index}`} stroke="none" />
                    ))}
                  </Pie>
                )}
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.valueWrapper}>
              <div className={styles.value}>
                {formatNumber(displayCenterValue)}
                {centerValue === undefined && valueSuffix}
              </div>
              {/* Rendered even when empty: gauges sitting side by side in a grid (resource usage panel)
                  have a label on some and not others, and an absent line shifts that gauge's value
                  text and everything below it out of alignment with its neighbours. */}
              <div className={styles.label}>{centerLabel || label || '\u00a0'}</div>
            </div>
          </div>
        </Tooltip>
        <div className={styles.footer}>
          <div>
            {formatNumber(min)}
            {valueSuffix}
          </div>
          <div>
            {formatNumber(max)}
            {valueSuffix}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Gauge;
