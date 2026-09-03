import { envCpuCores, envDiskBytes, envGpuDevices, envRamBytes, NodeMetricsHourly } from '@/types/node-metrics';
import { formatBytes, formatNumber } from '@/utils/formatters';

export const HOUR_MS = 3_600_000;

/**
 * Only two ranges on purpose. The gateway sends no content-encoding and a bucket costs a few KB (the
 * 64-char environment ids repeat once per resource per bucket), so 24h is ~90 KB and 7d ~650 KB,
 * while 30d would be megabytes and the node's full 180-day retention far worse, all over a single
 * hop. Both ranges also fit in 168 points or fewer, which is why nothing here downsamples.
 */
export type MetricsRange = '24h' | '7d';

export const METRICS_RANGES: { label: string; value: MetricsRange }[] = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
];

const RANGE_HOURS: Record<MetricsRange, number> = { '24h': 24, '7d': 24 * 7 };

/**
 * Hour-aligned start so the bins line up with `hourStart`; `stopTime` stays at raw now so the node
 * appends its live `partial: true` current-hour bucket. Epoch ms — a number is read as ms verbatim
 * by the node (only string params go through its >= 12-digit / Date.parse path).
 */
export function rangeToWindow(range: MetricsRange, now = Date.now()): { startTime: number; stopTime: number } {
  const currentHour = Math.floor(now / HOUR_MS) * HOUR_MS;
  return { startTime: currentHour - (RANGE_HOURS[range] - 1) * HOUR_MS, stopTime: now };
}

export type HistoryMetric = 'cpu' | 'disk' | 'gpu' | 'jobs' | 'memory';

export interface HistorySeries {
  /**
   * DASHED MEANS BOOKED, on every chart. Reserved for the reserved-capacity counterpart of a usage
   * line so that a dash carries the same meaning everywhere — which is why GPU, the one metric with
   * no booked figure on the wire, pairs two SOLID lines instead of dashing one of them.
   */
  dashed?: boolean;
  key: string;
  label: string;
  /**
   * Series color. Set only where a chart needs to break the default (usage accent, booked muted) —
   * GPU's two solid lines have to be told apart by hue, since neither may use the dash.
   */
  color?: string;
  /** `null` for an hour whose bucket can't produce this number — recharts breaks the line there. */
  value: (bucket: NodeMetricsHourly) => number | null;
}

export interface HistoryMetricSpec {
  /** `[0, 100]` for saturation metrics; omit to let recharts fit raw counts. */
  domain?: [number, number];
  format: (value: number) => string;
  series: HistorySeries[];
}

function meanGpu(bucket: NodeMetricsHourly, pick: (device: NodeMetricsHourly['gpu'][number]) => number | undefined) {
  const values = (bucket.gpu ?? []).map(pick).filter((value): value is number => typeof value === 'number');
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function historyMetricSpec(metric: HistoryMetric, excludeEnvIds?: Set<string>): HistoryMetricSpec {
  switch (metric) {
    case 'cpu':
      // Plotted as a fraction of what the node OFFERS (`env[]`, deduplicated — see `envCpuCores`),
      // not the raw host: usagePercent is docker-stats semantics summed over containers
      // (0..hostCores*100), and an operator commonly offers only part of the machine, so hostCores
      // would understate how full the node's own advertised pool actually is. Same denominator the
      // live bar uses, so a peak/booked tick here and the live tick land on the same scale.
      //
      // Used + Booked is the shape EVERY chart here follows (GPU excepted, which has no booked
      // figure). Same two words, same solid/dashed roles, same env-offered denominator.
      return {
        domain: [0, 100],
        format: (value) => `${Math.round(value)}%`,
        series: [
          {
            key: 'cpuUsed',
            label: 'Used',
            value: (bucket) => {
              const { total } = envCpuCores(bucket.env ?? [], excludeEnvIds);
              return total > 0 ? bucket.cpu.usagePercent / 100 / total * 100 : null;
            },
          },
          {
            dashed: true,
            key: 'cpuBooked',
            label: 'Booked',
            value: (bucket) => {
              const { booked, total } = envCpuCores(bucket.env ?? [], excludeEnvIds);
              return total > 0 ? (booked / total) * 100 : null;
            },
          },
        ],
      };
    case 'memory':
      // Used = what the C2D containers consume; Booked = what the node's environments offer/reserve
      // (`env[]`, deduplicated — see `envRamBytes`). Same denominator and shape as CPU.
      //
      // Deliberately NOT the whole machine's memory in use ((hostTotal - hostFree) / hostTotal), and
      // not the cgroup limits against host RAM either. The machine figure moved here as "Host" used to
      // read as a capacity line but moved with everything on the box — OS, other tenants, anything
      // unrelated to Ocean; the cgroup-against-host pairing put a per-container ceiling on a
      // machine-wide scale. Both are real numbers, just not this chart's.
      return {
        domain: [0, 100],
        format: (value) => `${Math.round(value)}%`,
        series: [
          {
            key: 'memUsed',
            label: 'Used',
            value: (bucket) => {
              const { totalBytes } = envRamBytes(bucket.env ?? [], excludeEnvIds);
              return totalBytes > 0 ? (bucket.memory.usedBytes / totalBytes) * 100 : null;
            },
          },
          {
            dashed: true,
            key: 'memBooked',
            label: 'Booked',
            value: (bucket) => {
              const { bookedBytes, totalBytes } = envRamBytes(bucket.env ?? [], excludeEnvIds);
              return totalBytes > 0 ? (bookedBytes / totalBytes) * 100 : null;
            },
          },
        ],
      };
    case 'jobs':
      // Hourly scalars are MEANS, so 0.4 concurrent jobs is a real value rather than a rounding bug.
      // The axis stays whole (allowDecimals={false}); the tooltip shows the fraction.
      return {
        format: (value) => formatNumber(Math.round(value * 10) / 10),
        series: [
          { key: 'jobsRunning', label: 'Running (avg)', value: (bucket) => bucket.jobs.running },
          { dashed: true, key: 'jobsQueued', label: 'Queued (avg)', value: (bucket) => bucket.jobs.queued },
        ],
      };
    case 'disk':
      // Bytes, not a percentage: a bucket carries `disk.usedBytes` and env capacity, but no HOST disk
      // total, so there is no machine-wide denominator to draw a ratio against. `domain` is left off
      // and the axis is absolute, which is also why the two series here are byte figures rather than
      // the percentages the other three charts plot.
      //
      // Booked still comes from the bucket's own `env[]` (disk `inUse`, GB), so this chart carries
      // the same Used/Booked pair as CPU and memory rather than a lone line.
      return {
        format: (value) => formatBytes(value),
        series: [
          { key: 'diskUsed', label: 'Used', value: (bucket) => bucket.disk?.usedBytes ?? null },
          {
            dashed: true,
            key: 'diskBooked',
            label: 'Booked',
            value: (bucket) => {
              const { bookedBytes } = envDiskBytes(bucket.env ?? [], excludeEnvIds);
              return bookedBytes > 0 ? bookedBytes : null;
            },
          },
        ],
      };
    case 'gpu':
      // Three series, because GPU carries two DIFFERENT usage readings (how hard the devices are
      // working, and how full their VRAM is) on top of the booked share every chart here shows.
      //
      // Booked is the fraction of DEVICES reserved (each `gpuN` env row is `total: 1`, `inUse: 1`
      // once booked), which is a different quantity from the other two — a node can have every
      // device booked while VRAM sits near empty. It shares the axis because all three are
      // percentages, and it stays dashed because dashed means booked on every chart in this set.
      return {
        domain: [0, 100],
        format: (value) => `${Math.round(value)}%`,
        series: [
          {
            color: 'var(--accent1)',
            key: 'gpuUtil',
            label: 'Used',
            value: (bucket) => meanGpu(bucket, (d) => d.utilizationPercent),
          },
          {
            color: 'var(--success-darker)',
            key: 'gpuVram',
            label: 'VRAM',
            value: (bucket) =>
              meanGpu(bucket, (device) =>
                typeof device.memoryUsedBytes === 'number' && device.memoryTotalBytes
                  ? (device.memoryUsedBytes / device.memoryTotalBytes) * 100
                  : undefined
              ),
          },
          {
            dashed: true,
            key: 'gpuBooked',
            label: 'Booked',
            value: (bucket) => {
              const { booked, total } = envGpuDevices(bucket.env ?? [], excludeEnvIds);
              return total > 0 ? (booked / total) * 100 : null;
            },
          },
        ],
      };
  }
}

export type ChartRow = { hourStart: number; partial: boolean; sampleCount: number | null } & Record<
  string,
  number | boolean | null
>;

/**
 * One row per hour across the WHOLE served window, so an hour the node never recorded lands as a real
 * `null` inside the array instead of being compressed away — with `connectNulls={false}` that becomes
 * a visible break rather than a line drawn straight through an outage.
 *
 * Absence and idleness must not look alike: an idle node still records a row (the engine caches a
 * well-formed all-zero aggregate on purpose), so a flat line at zero means "nothing was running"
 * while a gap means "the node wasn't reporting".
 */
export function toChartRows({
  buckets,
  series,
  startTime,
  stopTime,
}: {
  buckets: NodeMetricsHourly[];
  series: HistorySeries[];
  startTime: number;
  stopTime: number;
}): ChartRow[] {
  const byHour = new Map(buckets.map((bucket) => [bucket.hourStart, bucket]));
  const rows: ChartRow[] = [];
  const first = Math.floor(startTime / HOUR_MS) * HOUR_MS;
  for (let hour = first; hour <= stopTime; hour += HOUR_MS) {
    const bucket = byHour.get(hour);
    const row: ChartRow = {
      hourStart: hour,
      partial: bucket?.partial === true,
      sampleCount: bucket ? bucket.sampleCount : null,
    };
    series.forEach((entry) => {
      row[entry.key] = bucket ? entry.value(bucket) : null;
    });
    rows.push(row);
  }
  return rows;
}

/**
 * Bucket boundaries are floored UTC hours but ticks render in the viewer's zone, so on a
 * half-hour-offset timezone (IST, ACST) the labels land on :30. Deliberate: local time is what a
 * reader compares against their own clock.
 */
export function historyTimeFormatter(range: MetricsRange): (epochMs: number) => string {
  const formatter = new Intl.DateTimeFormat(
    'en-GB',
    range === '24h'
      ? { hour: '2-digit', hour12: false, minute: '2-digit' }
      : { day: 'numeric', hour: '2-digit', hour12: false, month: 'short' }
  );
  return (epochMs) => formatter.format(new Date(epochMs));
}
