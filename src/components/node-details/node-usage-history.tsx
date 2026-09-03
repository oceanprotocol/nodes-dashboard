import GpuIcon from '@/assets/icons/gpu.svg';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { resourceIconClass } from '@/components/resource-usage/usage-primitives';
import { useNodeMetricsHistory } from '@/hooks/use-node-metrics-history';
import {
  ChartRow,
  HistoryMetric,
  historyMetricSpec,
  HistoryMetricSpec,
  HistorySeries,
  historyTimeFormatter,
  HOUR_MS,
  METRICS_RANGES,
  MetricsRange,
  toChartRows,
} from '@/utils/node-metrics-series';
import DnsIcon from '@mui/icons-material/Dns';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import Collapse from '@mui/material/Collapse';
import cx from 'classnames';
import { useId, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import styles from './node-usage-history.module.css';

// One accent line and one muted dashed line per metric — with only two series there is no need for a
// categorical ramp, and the dash already says "this is the capacity counterpart".
const SERIES_COLORS = ['var(--accent1)', 'var(--text-secondary)'];

/**
 * GPU, CPU, memory, disk — the same four resources in the same order the live panel puts its gauges
 * and bars in, so the eye lands on the same resource in both halves of the card. Jobs is deliberately
 * not here: it is a count of work, not a resource, and it has no counterpart in the live row above.
 */
const HISTORY_CHARTS: { icon: React.ReactNode; key: HistoryMetric; title: string }[] = [
  { icon: <GpuIcon className={resourceIconClass} />, key: 'gpu', title: 'GPU' },
  { icon: <MemoryIcon className={resourceIconClass} />, key: 'cpu', title: 'CPU' },
  { icon: <SdStorageIcon className={resourceIconClass} />, key: 'memory', title: 'Memory' },
  { icon: <DnsIcon className={resourceIconClass} />, key: 'disk', title: 'Disk' },
];

type NodeUsageHistoryProps = {
  /** Only fetched once the live snapshot proved the node speaks these commands. */
  enabled: boolean;
  multiaddrs?: string[];
  peerId: string;
};

const HistoryTooltip: React.FC<{
  active?: boolean;
  format: (value: number) => string;
  formatTime: (epochMs: number) => string;
  payload?: { dataKey?: string | number; payload?: ChartRow; value?: number }[];
  series: HistorySeries[];
}> = ({ active, format, formatTime, payload, series }) => {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0].payload;
  if (!row) {
    return null;
  }
  return (
    <div className={styles.tooltip}>
      {/* The hour's range, not just its start — a bucket is an average over the whole hour. */}
      <div className={styles.tooltipHead}>
        {formatTime(row.hourStart)} - {formatTime(row.hourStart + HOUR_MS)}
      </div>
      {series.map((entry, index) => {
        const value = row[entry.key];
        return (
          <div className={styles.tooltipRow} key={entry.key}>
            <span style={{ color: SERIES_COLORS[index] }}>{entry.label}</span>
            <span className={styles.tooltipValue}>{typeof value === 'number' ? format(value) : 'no data'}</span>
          </div>
        );
      })}
      <div className={styles.tooltipFoot}>
        {row.sampleCount === null
          ? 'Not reported'
          : `${Math.round(row.sampleCount)} of 60 samples${row.partial ? ' · hour in progress' : ''}`}
      </div>
    </div>
  );
};

/**
 * One metric's chart, titled and with its own legend. Every axis, grid and tooltip decision is fixed
 * here rather than per call, because the three charts are small multiples: the moment one of them
 * scales or formats differently, comparing across them stops being valid.
 *
 * A metric the node reports nothing for (no GPU on the box) still renders its frame and says so,
 * rather than vanishing — a missing third chart would leave the reader guessing whether it failed to
 * load or the hardware isn't there.
 */
const HistoryChart: React.FC<{
  formatTime: (epochMs: number) => string;
  icon: React.ReactNode;
  metric: HistoryMetric;
  rows: ChartRow[];
  spec: HistoryMetricSpec;
  title: string;
}> = ({ formatTime, icon, metric, rows, spec, title }) => {
  const partialHour = useMemo(() => rows.find((row) => row.partial)?.hourStart ?? null, [rows]);
  // Reported for THIS metric, not for the window: a node with no GPU still reports every hour, so the
  // section-level coverage count would claim data this particular chart doesn't have.
  const hasSeriesData = rows.some((row) => spec.series.some((entry) => typeof row[entry.key] === 'number'));

  return (
    <Card
      className={styles.chartCell}
      direction="column"
      innerShadow="black"
      padding="sm"
      radius="sm"
      spacing="sm"
      variant="glass"
    >
      <div className={styles.chartHead}>
        <h6 className={styles.chartTitle}>
          {icon}
          {title}
        </h6>
        {hasSeriesData && (
          <div className={styles.legend}>
            {spec.series.map((entry, index) => (
              <span className={styles.legendItem} key={entry.key}>
                <span
                  className={cx(styles.legendSwatch, { [styles.legendSwatchDashed]: entry.dashed })}
                  style={{ background: entry.dashed ? undefined : SERIES_COLORS[index], color: SERIES_COLORS[index] }}
                />
                {entry.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.chart}>
        {hasSeriesData ? (
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={rows} margin={{ bottom: 0, left: 0, right: 8, top: 4 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="hourStart"
                domain={[rows[0].hourStart, rows[rows.length - 1].hourStart]}
                // One label per bucket is 24 (or 168) of them shoulder to shoulder; recharts drops
                // whatever doesn't clear the gap, and the ends are always kept so the axis still
                // states the window it covers. The gap is wider than the single-chart layout used:
                // three charts share the row's width, so each has a third of the room for labels.
                interval="preserveStartEnd"
                minTickGap={64}
                scale="time"
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                tickFormatter={formatTime}
                tickLine={false}
                type="number"
              />
              <YAxis
                allowDecimals
                axisLine={false}
                domain={spec.domain ?? [0, 'auto']}
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                tickFormatter={spec.format}
                tickLine={false}
                // Percent ticks ("100%") fit in 40; a formatted byte tick ("18.6 GB") does not, and
                // recharts wraps rather than widens — which lands the label off its own gridline.
                width={spec.domain ? 40 : 58}
              />
              {/* Declared before the series so it paints underneath. Marks where the last complete
                  hour ends: the trailing bucket averages only the minutes elapsed so far. */}
              {partialHour !== null && (
                <ReferenceLine stroke="var(--text-secondary)" strokeDasharray="2 4" x={partialHour} />
              )}
              {spec.series.map((entry, index) => (
                <Line
                  activeDot={{ r: 3 }}
                  // Hours the node never recorded are `null` rows and the line must BREAK there:
                  // connecting through would draw a straight line across an outage, which reads as
                  // steady operation. A flat line at zero means idle; a gap means not reporting.
                  connectNulls={false}
                  dataKey={entry.key}
                  // Dots are dropped at three-up: 24 markers in a third of the width is a dotted
                  // band rather than a line, and the tooltip already gives per-hour readings.
                  dot={false}
                  isAnimationActive={false}
                  key={entry.key}
                  stroke={SERIES_COLORS[index]}
                  strokeDasharray={entry.dashed ? '4 4' : undefined}
                  strokeWidth={1.5}
                  type="monotone"
                />
              ))}
              <Tooltip
                content={<HistoryTooltip format={spec.format} formatTime={formatTime} series={spec.series} />}
                cursor={{ stroke: 'var(--border)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.chartEmpty}>
            {metric === 'gpu' ? 'No GPU reported on this node' : 'Not reported for this window'}
          </div>
        )}
      </div>
    </Card>
  );
};

/**
 * The node's own hourly rollup (SQLite node-side, averaged per UTC hour, ~180 days of retention).
 * Hidden entirely when the node keeps no history: that is a node setting, not a failure worth a
 * message on someone else's page.
 *
 * Three charts at once rather than one behind metric tabs. Saturation on this node is a relationship
 * between the three resources — a CPU line pinned flat while GPU util climbs is the shape that says
 * "this node is GPU-bound", and tabs hid exactly that by only ever showing one of the pair. The range
 * toggle stays single and section-wide, since comparing charts across different windows is meaningless.
 */
const NodeUsageHistory: React.FC<NodeUsageHistoryProps> = ({ enabled, multiaddrs, peerId }) => {
  const [range, setRange] = useState<MetricsRange>('24h');
  const [open, setOpen] = useState(false);
  const regionId = useId();
  // Fetched even while collapsed, deliberately. The 503 that means "this node keeps no history" is
  // what hides the whole section, so deferring the read until first open would leave a header
  // promising history on a node that has none — and would show a permanent `loading` state, since
  // that is where the hook starts. The read is one-shot and cached per range.
  const { result, retry, state } = useNodeMetricsHistory({ enabled, multiaddrs, peerId, range });

  const formatTime = useMemo(() => historyTimeFormatter(range), [range]);
  const charts = useMemo(() => HISTORY_CHARTS.map((chart) => ({ ...chart, spec: historyMetricSpec(chart.key) })), []);
  // The axis is driven by the range the node ACTUALLY served: it clamps `startTime` to its own
  // retention horizon, so a node that has only been up a day answers a 7d request with a 1d window.
  // One row set for all three charts — same window, same buckets, so the series of every chart are
  // built in a single pass over the buckets.
  const rows = useMemo(() => {
    if (!result) {
      return [];
    }
    return toChartRows({
      buckets: result.buckets,
      series: charts.flatMap((chart) => chart.spec.series),
      startTime: result.startTime,
      stopTime: result.stopTime,
    });
  }, [charts, result]);
  const reported = rows.filter((row) => row.sampleCount !== null).length;

  if (state === 'unavailable') {
    return null;
  }

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        {/* The heading is the toggle: the whole row is the target, so opening the section doesn't
            require aiming at a chevron. */}
        <button
          aria-controls={regionId}
          aria-expanded={open}
          className={styles.headToggle}
          onClick={() => setOpen((isOpen) => !isOpen)}
          type="button"
        >
          <ExpandMoreIcon className={cx(styles.headIcon, { [styles.headIconOpen]: open })} />
          <h5>Usage history</h5>
        </button>

        {/* Range applies to all three charts, so it stays in the section head rather than repeating
            per chart. Rendered only while open — a control that governs hidden content is a trap. */}
        {open && (
          <div className={styles.group}>
            {METRICS_RANGES.map((option) => (
              <Button
                color={range === option.value ? 'accent2' : 'primary'}
                key={option.value}
                onClick={() => setRange(option.value)}
                size="xs"
                variant={range === option.value ? 'filled' : 'transparent'}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <Collapse id={regionId} in={open} mountOnEnter>
        <div className={styles.body}>
          {state === 'loading' && (
            <div className={styles.chartGrid}>
              {charts.map((chart) => (
                <Card
                  className={styles.chartCell}
                  direction="column"
                  innerShadow="black"
                  key={chart.key}
                  padding="sm"
                  radius="sm"
                  spacing="sm"
                  variant="glass"
                >
                  <div className={styles.skeleton} />
                </Card>
              ))}
            </div>
          )}

          {state === 'error' && (
            <div className={styles.placeholder}>
              <span>Couldn&apos;t load usage history for this node.</span>
              <Button color="accent2" onClick={retry} size="sm" variant="filled">
                Try again
              </Button>
            </div>
          )}

          {state === 'ok' && reported === 0 && (
            <div className={styles.placeholder}>
              <span>No history for this window yet. This node records one point per hour.</span>
            </div>
          )}

          {state === 'ok' && reported > 0 && (
            <>
              <div className={styles.chartGrid}>
                {charts.map((chart) => (
                  <HistoryChart
                    formatTime={formatTime}
                    icon={chart.icon}
                    key={chart.key}
                    metric={chart.key}
                    rows={rows}
                    spec={chart.spec}
                    title={chart.title}
                  />
                ))}
              </div>

              {/* Honest one-line data-quality summary, once for the row rather than under each chart —
                  all three read the same buckets. One missing hour right after the top of the hour is
                  normal: the node rolls the previous hour up at :05. */}
              <div className={styles.coverage}>
                Reported {reported} of {rows.length} hours
              </div>
            </>
          )}
        </div>
      </Collapse>
    </div>
  );
};

export default NodeUsageHistory;
