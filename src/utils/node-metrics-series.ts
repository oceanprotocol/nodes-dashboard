import { NodeMetricsHourly } from '@/types/node-metrics';
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
  /** Dashed = the capacity/booked counterpart of a usage line. */
  dashed?: boolean;
  key: string;
  label: string;
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

export function historyMetricSpec(metric: HistoryMetric): HistoryMetricSpec {
  switch (metric) {
    case 'cpu':
      // Plotted as a fraction of the machine rather than raw usagePercent: that field is docker-stats
      // semantics summed over containers (0..hostCores*100), so on a 16-core host it reaches 1600.
      // The gap between booked and used is the reading an operator actually wants.
      return {
        domain: [0, 100],
        format: (value) => `${Math.round(value)}%`,
        series: [
          {
            key: 'cpuUsed',
            label: 'Used',
            value: (bucket) => (bucket.cpu.hostCores ? bucket.cpu.usagePercent / bucket.cpu.hostCores : null),
          },
          {
            dashed: true,
            key: 'cpuBooked',
            label: 'Booked',
            value: (bucket) => (bucket.cpu.hostCores ? (bucket.cpu.coresAllocated / bucket.cpu.hostCores) * 100 : null),
          },
        ],
      };
    case 'memory':
      return {
        domain: [0, 100],
        format: (value) => `${Math.round(value)}%`,
        series: [
          {
            key: 'memHost',
            label: 'Host',
            value: (bucket) =>
              bucket.memory.hostTotalBytes
                ? ((bucket.memory.hostTotalBytes - bucket.memory.hostFreeBytes) / bucket.memory.hostTotalBytes) * 100
                : null,
          },
          {
            dashed: true,
            key: 'memWorkloads',
            label: 'Workloads',
            value: (bucket) =>
              bucket.memory.hostTotalBytes ? (bucket.memory.usedBytes / bucket.memory.hostTotalBytes) * 100 : null,
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
      // Bytes, not a percentage: an hourly bucket carries `disk.usedBytes` with no host total and no
      // env capacity, so unlike the other three charts this one has no denominator and its axis is
      // absolute. `domain` is therefore left off, letting recharts fit the range actually observed.
      //
      // One series only. There is no booked counterpart on the wire for disk over time — the live
      // panel derives that from the snapshot's `env[]`, which hourly buckets do carry, but as a
      // capacity figure that is config rather than measurement: replaying it as a second line would
      // draw a flat line that only moves when the operator edits the node's config.
      return {
        format: (value) => formatBytes(value),
        series: [{ key: 'diskUsed', label: 'Used', value: (bucket) => bucket.disk?.usedBytes ?? null }],
      };
    case 'gpu':
      return {
        domain: [0, 100],
        format: (value) => `${Math.round(value)}%`,
        series: [
          { key: 'gpuUtil', label: 'Utilization', value: (bucket) => meanGpu(bucket, (d) => d.utilizationPercent) },
          {
            dashed: true,
            key: 'gpuVram',
            label: 'VRAM',
            value: (bucket) =>
              meanGpu(bucket, (device) =>
                typeof device.memoryUsedBytes === 'number' && device.memoryTotalBytes
                  ? (device.memoryUsedBytes / device.memoryTotalBytes) * 100
                  : undefined
              ),
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
