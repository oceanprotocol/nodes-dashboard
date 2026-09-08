/**
 * Presentational pieces shared by the container usage panel and the node one. All of them are cut
 * verbatim out of `resource-usage-panel.tsx` — the point is that both panels draw the same picture
 * from the same rules, so a change to a bar or a gauge card lands in both instead of drifting.
 */
import Card from '@/components/card/card';
import Gauge from '@/components/chart/gauge';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import ProgressBar, { ProgressBarMarker } from '@/components/progress-bar/progress-bar';
import {
  DANGER_AT,
  GpuDeviceRow,
  percentLabel,
  roundPercent,
  WARN_AT,
} from '@/components/resource-usage/usage-metrics';
import { formatNumber } from '@/utils/formatters';
import cx from 'classnames';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import styles from './usage-panel.module.css';

/**
 * The panels put resource icons in their own stat labels and summary bars, so they need the class
 * without the stylesheet. Exported as a string rather than re-wrapping every MUI icon.
 */
export const resourceIconClass = styles.resourceIcon;

/** Icon + name on one line, so a gauge heading reads as "which resource" at a glance. */
export const GaugeTitle: React.FC<{ children: React.ReactNode; icon: React.ReactNode }> = ({ children, icon }) => (
  <span className={styles.gaugeTitle}>
    {icon}
    {children}
  </span>
);

/**
 * Axis/grid/legend-free trend line over the samples collected since this view opened — enough to show
 * "is this climbing" without a second reading of the same number. Labelled, because an unlabelled area
 * under a gauge reads as decoration; renders an empty slot (not nothing) when a metric has no history,
 * so the gauges stay on one baseline.
 */
export const Sparkline: React.FC<{ data: number[]; metric: string; span: string }> = ({ data, metric, span }) => (
  <div className={styles.sparklineWrap}>
    <div className={styles.sparkline}>
      {data.length >= 3 && (
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            {/* Fixed 0-100 domain: an auto domain rescales a 3.7-3.9% wobble into a dramatic climb. */}
            <YAxis domain={[0, 100]} hide />
            <Area
              dataKey="v"
              fill="var(--accent1-lightest)"
              fillOpacity={0.5}
              isAnimationActive={false}
              stroke="var(--accent1)"
              strokeWidth={1.5}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
    <div className={styles.sparklineLabel}>
      {data.length >= 3 ? `${metric} trend · last ${span}` : `${metric} trend · collecting…`}
    </div>
  </div>
);

/**
 * A labelled 0-100% bar with optional peak and booked ticks — the GPU form of the gauges above. A rig
 * can be booked with eight devices, and sixteen arcs is a wall of charts; eight rows of bars stay
 * scannable because the fills line up on a shared axis.
 *
 * Built on the shared `ProgressBar`, which owns the track, the label rows, the MUI wiring and the
 * marker ticks; peak and booked are passed to it as markers. Only the severity color is ours, applied
 * to the MUI fill by class.
 *
 * `booked` is what has been RESERVED on this resource, against the same denominator as `value` — the
 * gap between the fill and that tick is headroom someone has already paid to hold. It draws as the
 * same tick as the peak, so each one's hover text has to name which it is.
 */
export const UsageBar: React.FC<{
  booked?: number;
  bookedTitle?: string;
  detail?: string;
  icon?: React.ReactNode;
  label: string;
  peak?: number;
  value: number;
}> = ({ booked, bookedTitle, detail, icon, label, peak, value }) => {
  const clamped = Math.min(100, Math.max(0, value));
  const markers: ProgressBarMarker[] = [];
  if (peak !== undefined) {
    markers.push({ title: `peak: ${formatNumber(roundPercent(peak))}%`, value: peak });
  }
  if (booked !== undefined) {
    markers.push({ title: bookedTitle ?? `booked: ${formatNumber(roundPercent(booked))}%`, value: booked });
  }
  return (
    <div className={styles.bar}>
      <ProgressBar
        bottomLeftContent={detail ? <span className={styles.barDetail}>{detail}</span> : undefined}
        className={cx(styles.barProgress, {
          [styles.barWarning]: value >= WARN_AT && value < DANGER_AT,
          [styles.barDanger]: value >= DANGER_AT,
        })}
        markers={markers}
        topLeftContent={
          <span className={styles.barLabel}>
            {icon}
            {label}
          </span>
        }
        topRightContent={<span className={styles.barValue}>{formatNumber(roundPercent(value))}%</span>}
        value={clamped}
      />
    </div>
  );
};

/**
 * One counter: a label above its reading. These are steady-state numbers (bytes moved, processes
 * open, CPU seconds burned), not states — a pill around each one implied a discrete condition the
 * way the signal chips genuinely do, and read as leftovers under the gauges. Laid out on the same
 * grid so the values line up in a column.
 */
export const Stat: React.FC<{ children: React.ReactNode; icon?: React.ReactNode; label: string }> = ({
  children,
  icon,
  label,
}) => (
  <div className={styles.stat}>
    <div className={styles.statLabel}>
      {icon}
      {label}
    </div>
    <div className={styles.statValue}>{children}</div>
  </div>
);

/**
 * The denominator in "219 / 4.1K" — present, but not what the eye should land on. A component rather
 * than an exported class name, so `.stat .statValueMuted` stays an intra-module selector.
 */
export const StatMuted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className={styles.statValueMuted}>{children}</span>
);

/** Two readings that only mean something as a pair (in/out, read/write), split rather than joined by
 * a slash inside one line — the arrow carries the direction, so no words are needed. */
export const StatPair: React.FC<{ icon?: React.ReactNode; label: string; rows: { key: string; value: string }[] }> = ({
  icon,
  label,
  rows,
}) => (
  <div className={styles.stat}>
    <div className={styles.statLabel}>
      {icon}
      {label}
    </div>
    <div className={styles.statPair}>
      {rows.map((row) => (
        <div className={styles.statPairRow} key={row.key}>
          <span className={styles.statPairKey}>{row.key}</span>
          <span className={styles.statValue}>{row.value}</span>
        </div>
      ))}
    </div>
  </div>
);

/**
 * One arc in the "General" grid. Every Card/Gauge prop is fixed here rather than at the call sites,
 * so four cards in one panel and three in another cannot drift apart.
 */
export const UsageGaugeCard: React.FC<{
  centerLabel: string;
  compact: boolean;
  /** Hardware name under the arc (the CPU model) — rendered through HardwareLabel for the logo. */
  hardwareName?: string;
  icon: React.ReactNode;
  /** Secondary reading beside the value, e.g. "42% utilization" on the VRAM arc. */
  label?: string;
  peak?: number;
  sparkline?: { data: number[]; metric: string; span: string };
  title: string;
  value: number;
}> = ({ centerLabel, compact, hardwareName, icon, label, peak, sparkline, title, value }) => (
  <Card
    className={styles.gaugeItem}
    direction="column"
    innerShadow="black"
    padding="sm"
    radius="sm"
    spacing="sm"
    variant="glass"
  >
    <Gauge
      centerLabel={centerLabel}
      color="range"
      dangerAt={DANGER_AT}
      label={label}
      max={100}
      min={0}
      peak={peak}
      peakLabel={percentLabel(peak)}
      size={compact ? 'compact' : 'small'}
      title={<GaugeTitle icon={icon}>{title}</GaugeTitle>}
      value={roundPercent(value)}
      valueSuffix="%"
      warnAt={WARN_AT}
    />
    {/* Only the CPU arc names its hardware today; `type="cpu"` picks the vendor logo. */}
    {hardwareName && <HardwareLabel className={styles.hardwareLabel} type="cpu" value={hardwareName} />}
    {!compact && sparkline && <Sparkline data={sparkline.data} metric={sparkline.metric} span={sparkline.span} />}
  </Card>
);

/**
 * The three grids each carry the `compact` co-class, which is the drift-prone bit — wrapped so no
 * panel has to remember the `cx(...)`.
 */
export const UsageSummaryGrid: React.FC<{ children: React.ReactNode; compact: boolean }> = ({ children, compact }) => (
  <div className={cx(styles.summaryGrid, { [styles.compact]: compact })}>{children}</div>
);

export const UsageGaugeGrid: React.FC<{ children: React.ReactNode; compact: boolean }> = ({ children, compact }) => (
  <div className={cx(styles.gaugesGrid, { [styles.compact]: compact })}>{children}</div>
);

export const UsageStatsSection: React.FC<{ children: React.ReactNode; compact: boolean; heading: string }> = ({
  children,
  compact,
  heading,
}) => (
  <div className={cx(styles.statsSection, { [styles.compact]: compact })}>
    <h5>{heading}</h5>
    <div className={styles.statsGrid}>{children}</div>
  </div>
);

/**
 * Per-device GPU detail — one card per device rather than one full-width row. Identical output in
 * both panels; a node device simply never sets `shared`, so the caveat chip stays off there.
 */
export const GpuDeviceSection: React.FC<{ compact: boolean; rows: GpuDeviceRow[] }> = ({ compact, rows }) => (
  <div className={cx(styles.gpuSection, { [styles.compact]: compact })}>
    <h5>Per GPU</h5>
    <div className={styles.gpuList}>
      {rows.map((row) => (
        <Card
          className={styles.gpuCard}
          direction="column"
          innerShadow="black"
          key={row.resourceId}
          padding="sm"
          radius="sm"
          spacing="sm"
          variant="glass"
        >
          <HardwareLabel className={styles.hardwareLabel} iconHeight={16} type="gpu" value={row.name} />
          <div className={styles.gpuBars}>
            {row.util !== undefined && <UsageBar label="Utilization" peak={row.utilPeak} value={row.util} />}
            {row.vram !== undefined && (
              <UsageBar detail={row.vramDetail} label="VRAM" peak={row.vramPeak} value={row.vram} />
            )}
          </div>
          {/* A node's snapshot names its GPUs by opaque id and may carry no vendor at all, in which
              case HardwareLabel renders nothing — so the foot (which holds the id) also has to show
              up on a nameless device, or the card would identify nothing. */}
          {(!row.name || row.shared || row.thermal) && (
            <div className={styles.gpuCardFoot}>
              {/* A shared device's numbers include other tenants' load, so this is a caveat on
                  whether the readings above can be trusted — not a detail to bury in meta. */}
              <div>
                {row.shared && <span className="chip chipWarning">Shared</span>}
                {row.thermal && <span className={styles.gpuThermal}>{row.thermal}</span>}
              </div>
              <span className={styles.gpuId}>#{row.resourceId}</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  </div>
);
