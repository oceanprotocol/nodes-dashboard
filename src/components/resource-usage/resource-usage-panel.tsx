import GpuIcon from '@/assets/icons/gpu.svg';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Gauge from '@/components/chart/gauge';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import ProgressBar from '@/components/progress-bar/progress-bar';
import { ContainerMetricsSnapshot, UsageSample } from '@/types/runtime-metrics';
import { formatBytes, formatNumber } from '@/utils/formatters';
import BoltIcon from '@mui/icons-material/Bolt';
import DnsIcon from '@mui/icons-material/Dns';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import cx from 'classnames';
import { useId, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import styles from './resource-usage-panel.module.css';

// Saturation thresholds shared by every bounded gauge here — "your allocation is too small" starts
// to matter well before 100%, and this keeps CPU/memory/disk/GPU reading the same color language.
const WARN_AT = 85;
const DANGER_AT = 95;

// Docker's CFS accounting reports a stray throttled period now and then on a container that is
// nowhere near its quota, so "throttledPeriods > 0" is background noise, not a condition worth
// warning about — a container using 0.2% of its cores was never actually held back. Only a full
// second of accumulated throttling means the workload genuinely lost CPU it asked for.
const THROTTLE_FLOOR_SECONDS = 1;

// A tick is only worth drawing when it's meaningfully above the current reading — right on top of
// it just adds visual noise, and it needs at least one other sample to be a "peak" at all.
function resolvePeak(current: number, values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const max = Math.max(current, ...values);
  return max - current >= 1 ? max : undefined;
}

/** `cpu.usagePercentOfAllocated` when the node itself knows the allocation; otherwise derive it
 * from `usagePercent` (which is cores-used * 100) against whatever denominator is available. */
function cpuPercentOfCores(usagePercent: number, usagePercentOfAllocated: number | null, allocated?: number): number {
  if (usagePercentOfAllocated !== null) {
    return usagePercentOfAllocated;
  }
  if (allocated) {
    return (usagePercent / 100 / allocated) * 100;
  }
  return usagePercent;
}

/** Peak-tick tooltip text, or undefined when there's no peak worth marking. */
function percentLabel(value: number | undefined): string | undefined {
  return value === undefined ? undefined : `${formatNumber(Math.round(value))}%`;
}

/** One decimal is all a saturation reading carries — raw ratios arrive as 91.66666…%. */
function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Consumed CPU time, which is an arbitrary number of seconds rather than a booked round duration —
 * `formatDuration` would render it as "5400 s (01:30:00)". Compact two-unit form instead.
 */
function formatCpuTime(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  if (sec < 60) {
    return `${sec}s`;
  }
  if (sec < 3600) {
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  }
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

/** How much wall-clock the ring buffer currently covers — labels the sparkline honestly, since the
 * span depends on poll cadence (4s for services, 15s for jobs) and how long the view has been open. */
function formatSpan(samples: UsageSample[]): string {
  if (samples.length < 2) {
    return '—';
  }
  const seconds = Math.max(
    0,
    Math.round(
      (new Date(samples[samples.length - 1].collectedAt).getTime() - new Date(samples[0].collectedAt).getTime()) / 1000
    )
  );
  if (seconds < 90) {
    return `${seconds}s`;
  }
  return `${Math.round(seconds / 60)}m`;
}

function formatFreshness(seconds: number): string {
  if (seconds < 5) {
    return 'just now';
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.round(minutes / 60)}h ago`;
}

/** Icon + name on one line, so a gauge heading reads as "which resource" at a glance. */
const GaugeTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
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
const Sparkline: React.FC<{ data: number[]; metric: string; span: string }> = ({ data, metric, span }) => (
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
 * A labelled 0-100% bar with an optional peak tick — the GPU form of the gauges above. A rig can be
 * booked with eight devices, and sixteen arcs is a wall of charts; eight rows of bars stay scannable
 * because the fills line up on a shared axis.
 *
 * Built on the shared `ProgressBar`, which owns the track, the label rows, the MUI wiring and the
 * marker tick; the peak is passed to it as a marker. Only the severity color is ours, applied to the
 * MUI fill by class.
 */
const UsageBar: React.FC<{
  label: string;
  value: number;
  peak?: number;
  detail?: string;
  icon?: React.ReactNode;
}> = ({ label, value, peak, detail, icon }) => {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={styles.bar}>
      <ProgressBar
        bottomLeftContent={detail ? <span className={styles.barDetail}>{detail}</span> : undefined}
        className={cx(styles.barProgress, {
          [styles.barWarning]: value >= WARN_AT && value < DANGER_AT,
          [styles.barDanger]: value >= DANGER_AT,
        })}
        marker={peak !== undefined ? { title: `peak: ${formatNumber(roundPercent(peak))}%`, value: peak } : undefined}
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
const Stat: React.FC<{ label: string; children: React.ReactNode; icon?: React.ReactNode }> = ({
  label,
  children,
  icon,
}) => (
  <div className={styles.stat}>
    <div className={styles.statLabel}>
      {icon}
      {label}
    </div>
    <div className={styles.statValue}>{children}</div>
  </div>
);

/** Two readings that only mean something as a pair (in/out, read/write), split rather than joined by
 * a slash inside one line — the arrow carries the direction, so no words are needed. */
const StatPair: React.FC<{ label: string; rows: { key: string; value: string }[]; icon?: React.ReactNode }> = ({
  label,
  rows,
  icon,
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

export interface ResourceUsagePanelProps {
  metrics: ContainerMetricsSnapshot | null;
  /** Client-side ring buffer (see `useMetricsHistory`) — powers peak ticks and the sparkline. */
  history?: UsageSample[];
  /** `page` (manage-service-page) shows sparklines; `compact` (job info modal) omits them to stay dense. */
  variant?: 'page' | 'compact';
  /**
   * The allocation this workload actually booked, so a gauge still has a denominator when the
   * snapshot's own field is empty (unconstrained CPU, no disk quota). Display units: cores / bytes.
   */
  bookedResources?: { cpuCores?: number; ramBytes?: number; diskBytes?: number };
  /**
   * resourceId -> hardware name, from the compute environment's resource descriptions (e.g.
   * `gpu2` -> "NVIDIA RTX 4090", `cpu` -> "Intel Xeon Platinum 8480+"). The runtime snapshot only
   * carries opaque ids, which say nothing about the hardware; each name falls back to the id.
   */
  hardwareNames?: Record<string, string>;
  /**
   * Start expanded. Default (`false`) opens on the summary — four arcs and any warning signals, which
   * answer "is anything saturated, is anything wrong" without the reader scrolling past trends, every
   * GPU device and the throughput counters to find out.
   */
  defaultExpanded?: boolean;
  /**
   * The panel's heading, passed as JSX so each call site picks the element its own document outline
   * needs (an `h3` on the manage page, a `strong` inside the job modal). Rendered on the same line as
   * the expand toggle, with the freshness line beneath it.
   */
  title?: React.ReactNode;
}

/**
 * Renders nothing when `metrics` is null — every call site decides its own empty-state copy
 * ("this node doesn't report runtime metrics" vs. simply nothing), since what's meaningful there
 * differs by context (a running service vs. a queued compute job).
 */
const ResourceUsagePanel: React.FC<ResourceUsagePanelProps> = ({
  metrics,
  history = [],
  variant = 'page',
  bookedResources,
  hardwareNames,
  defaultExpanded = false,
  title,
}) => {
  const compact = variant === 'compact';
  const [expanded, setExpanded] = useState(defaultExpanded);
  const detailsId = useId();

  const cpuHistory = useMemo(
    () => history.map((s) => cpuPercentOfCores(s.cpuPercent, s.cpuPercentOfAllocated, bookedResources?.cpuCores)),
    [history, bookedResources?.cpuCores]
  );
  const memHistory = useMemo(() => history.map((s) => s.memoryPercent), [history]);

  if (!metrics) {
    return null;
  }

  const { cpu, memory, disk, network, blockIO, pids, gpu, containerState } = metrics;
  const isFinal = containerState.status !== 'running';
  const secondsAgo = Math.max(0, Math.round((Date.now() - new Date(metrics.collectedAt).getTime()) / 1000));
  const freshnessText = `${isFinal ? 'Last update' : 'Updated'} ${formatFreshness(secondsAgo)}`;

  // CPU
  const effectiveCpuAllocated = cpu.allocated > 0 ? cpu.allocated : bookedResources?.cpuCores;
  const cpuValue = cpuPercentOfCores(
    cpu.usagePercent,
    cpu.allocated > 0 ? cpu.usagePercentOfAllocated : null,
    effectiveCpuAllocated
  );
  const coresUsed = (cpu.usagePercent / 100).toFixed(1);
  const cpuCenterLabel = effectiveCpuAllocated
    ? `${coresUsed} / ${effectiveCpuAllocated} cores`
    : `${coresUsed} cores · unlimited`;
  const cpuPeak = resolvePeak(cpuValue, cpuHistory);
  const cpuName = hardwareNames?.cpu;

  // Memory — `usagePercent` is the node's own usage/limit, so an unconstrained container (limitBytes 0)
  // needs the booked amount as a denominator. With neither, there is no ratio to draw: the gauge is
  // dropped and usage becomes a plain stat below, same rule as disk.
  const effectiveMemLimit = memory.limitBytes || bookedResources?.ramBytes;
  const memValue = effectiveMemLimit
    ? memory.limitBytes > 0
      ? memory.usagePercent
      : (memory.usageBytes / effectiveMemLimit) * 100
    : undefined;
  const memPeakPercent = effectiveMemLimit ? (memory.peakUsageBytes / effectiveMemLimit) * 100 : undefined;
  const memPeak =
    memValue !== undefined && memPeakPercent !== undefined && memPeakPercent - memValue >= 1
      ? memPeakPercent
      : undefined;

  // Disk — a gauge only when SOME denominator exists (the node's own quota, or the booked amount);
  // otherwise a ratio would have no honest meaning, so it's a plain stat instead.
  const effectiveDiskQuota = disk.quotaBytes ?? bookedResources?.diskBytes;
  const diskValue = effectiveDiskQuota ? (disk.usagePercent ?? (disk.usedBytes / effectiveDiskQuota) * 100) : undefined;
  // Same denominator rule as the gauge above: the node's own ratio when it sent one, otherwise
  // used-bytes against whatever quota is known (the node's, or the booked allocation).
  const diskHistory = history
    .map((s) => s.diskPercent ?? (effectiveDiskQuota ? (s.diskUsedBytes / effectiveDiskQuota) * 100 : null))
    .filter((v): v is number => v !== null);
  const diskPeak = diskValue !== undefined ? resolvePeak(diskValue, diskHistory) : undefined;

  // Trends render on the page variant whether or not there's history yet — an area chart that pops in
  // under two of four gauges (and shifts them) reads as a rendering bug. Collapsed, the arcs alone
  // answer "how loaded is this"; a trend is the follow-up question, so it rides the details Collapse.
  const historySpan = formatSpan(history);

  // GPU rows — a device is one row (name + utilization bar + VRAM bar), not two arcs, so a booking
  // with eight devices stays a scannable list. Temp/power ride along as row meta instead of chips at
  // the bottom, which lost track of which device they belonged to once there was more than one.
  const gpuRows = (gpu ?? [])
    .map((device) => {
      const hasVram =
        typeof device.memoryUsedBytes === 'number' &&
        typeof device.memoryTotalBytes === 'number' &&
        device.memoryTotalBytes > 0;
      const util = typeof device.utilizationPercent === 'number' ? device.utilizationPercent : undefined;
      const vram = hasVram
        ? ((device.memoryUsedBytes as number) / (device.memoryTotalBytes as number)) * 100
        : undefined;
      const utilHistory = history
        .map((s) => s.gpuUtilizationPercent[device.resourceId])
        .filter((v): v is number => v !== undefined);
      const vramHistory = history
        .map((s) => s.gpuMemoryPercent[device.resourceId])
        .filter((v): v is number => v !== undefined);
      const thermal = [
        typeof device.temperatureC === 'number' ? `${Math.round(device.temperatureC)}°C` : null,
        typeof device.powerWatts === 'number' ? `${Math.round(device.powerWatts)}W` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      // HardwareLabel turns "NVIDIA H200" into a logo + "H200"; with no description from the
      // environment, the vendor alone still gets the right logo (the id is shown as meta anyway).
      const name = hardwareNames?.[device.resourceId] || device.vendor;
      return {
        resourceId: device.resourceId,
        name,
        shared: Boolean(device.shared),
        thermal,
        util,
        utilPeak: util !== undefined ? resolvePeak(util, utilHistory) : undefined,
        vram,
        vramPeak: vram !== undefined ? resolvePeak(vram, vramHistory) : undefined,
        vramDetail: hasVram
          ? `${formatBytes(device.memoryUsedBytes as number)} / ${formatBytes(device.memoryTotalBytes as number)}`
          : undefined,
      };
    })
    .filter((row) => row.util !== undefined || row.vram !== undefined);

  // One primary GPU gauge beside CPU/memory/disk, so the top row answers "how loaded is this box"
  // across all four resource kinds. The arc is aggregate VRAM rather than utilization: VRAM is the
  // hard ceiling for an inference workload (out of VRAM = the model won't load), while utilization
  // swings 0-100% between requests and reads 0% on an idle-but-fully-loaded service. Utilization
  // still shows as the center label, and per-device detail is in the rows below.
  const gpuTotals = (gpu ?? []).reduce(
    (acc, device) => {
      if (typeof device.memoryUsedBytes === 'number' && typeof device.memoryTotalBytes === 'number') {
        acc.usedBytes += device.memoryUsedBytes;
        acc.totalBytes += device.memoryTotalBytes;
      }
      if (typeof device.utilizationPercent === 'number') {
        acc.utilSum += device.utilizationPercent;
        acc.utilCount += 1;
      }
      return acc;
    },
    { usedBytes: 0, totalBytes: 0, utilSum: 0, utilCount: 0 }
  );
  const gpuVramValue = gpuTotals.totalBytes > 0 ? (gpuTotals.usedBytes / gpuTotals.totalBytes) * 100 : undefined;
  const gpuAvgUtil = gpuTotals.utilCount > 0 ? gpuTotals.utilSum / gpuTotals.utilCount : undefined;
  const gpuVramHistory = history
    .map((sample) => {
      const values = Object.values(sample.gpuMemoryPercent);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
    })
    .filter((v): v is number => v !== undefined);
  const gpuVramPeak = gpuVramValue !== undefined ? resolvePeak(gpuVramValue, gpuVramHistory) : undefined;
  const deviceCount = gpuRows.length;

  // Chips are kept for exactly the things that are exceptional and worth shouting about (OOM kill,
  // throttling, restarts, a bad exit) — and hoisted above the gauges, since an OOM kill under four
  // rows of charts is found too late to matter. Steady-state counters moved out to `Stat`s below.
  // Collapsed summary: the same four resources the gauges draw, as bars. A bar carries the one thing
  // the summary owes the reader (how close to full), in a fraction of the height four arcs need, and
  // reuses the gauges' severity colors so a red bar and a red arc mean the same thing.
  const summaryBars: {
    key: string;
    label: string;
    value: number;
    peak?: number;
    detail?: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'cpu',
      label: 'CPU',
      value: cpuValue,
      peak: cpuPeak,
      detail: cpuCenterLabel,
      icon: <MemoryIcon className={styles.resourceIcon} />,
    },
  ];
  if (memValue !== undefined) {
    summaryBars.push({
      key: 'memory',
      label: 'Memory',
      value: memValue,
      peak: memPeak,
      detail: `${formatBytes(memory.usageBytes)} / ${formatBytes(effectiveMemLimit as number)}`,
      icon: <SdStorageIcon className={styles.resourceIcon} />,
    });
  }
  if (diskValue !== undefined) {
    summaryBars.push({
      key: 'disk',
      label: 'Disk',
      value: diskValue,
      peak: diskPeak,
      detail: `${formatBytes(disk.usedBytes)} / ${formatBytes(effectiveDiskQuota as number)}`,
      icon: <DnsIcon className={styles.resourceIcon} />,
    });
  }
  if (gpuVramValue !== undefined) {
    summaryBars.push({
      key: 'vram',
      label: deviceCount > 1 ? `GPU VRAM · ${deviceCount} devices` : 'GPU VRAM',
      value: gpuVramValue,
      peak: gpuVramPeak,
      detail: `${formatBytes(gpuTotals.usedBytes)} / ${formatBytes(gpuTotals.totalBytes)}`,
      icon: <GpuIcon className={styles.resourceIcon} />,
    });
  }

  // Single source of truth for both the signals-row gate and the chip: they disagreed (`> 0` vs
  // `>= 1`), so a sub-second throttle opened the row for a chip that then declined to render — or,
  // rounded, rendered as the self-contradicting "throttled 0s".
  const isThrottled = cpu.throttledSeconds >= THROTTLE_FLOOR_SECONDS;

  const hasSignals =
    containerState.oomKilled ||
    isThrottled ||
    containerState.restartCount > 0 ||
    (containerState.exitCode != null && containerState.status !== 'running') ||
    Boolean(containerState.health);

  return (
    <div className={cx(styles.root, { [styles.compactRoot]: compact })}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          {title}
          <div className={cx('textSecondary', styles.freshness)}>{freshnessText}</div>
        </div>
        <Button
          aria-controls={detailsId}
          aria-expanded={expanded}
          className={styles.toggle}
          color="accent2"
          contentAfter={<ExpandMoreIcon className={cx(styles.toggleIcon, { [styles.toggleIconOpen]: expanded })} />}
          onClick={() => setExpanded((open) => !open)}
          size="sm"
          variant="filled"
        >
          {expanded ? 'Less info' : 'More info'}
        </Button>
      </div>

      {hasSignals && (
        <div className={styles.signalsRow}>
          {containerState.oomKilled && <span className="chip chipError">Out of memory</span>}
          {isThrottled && (
            <Tooltip
              title={`This workload was held at its CPU limit for ${formatCpuTime(
                cpu.throttledSeconds
              )} across ${formatNumber(cpu.throttledPeriods)} scheduling ${
                cpu.throttledPeriods === 1 ? 'period' : 'periods'
              } — it asked for more CPU than it booked.`}
            >
              <span className="chip chipWarning">CPU throttled {formatCpuTime(cpu.throttledSeconds)}</span>
            </Tooltip>
          )}
          {containerState.restartCount > 0 && (
            <span className="chip chipGlass">Restarted {containerState.restartCount}×</span>
          )}
          {containerState.exitCode != null && containerState.status !== 'running' && (
            <span className={cx('chip', containerState.exitCode === 0 ? 'chipGlass' : 'chipWarning')}>
              Exited with code {containerState.exitCode}
            </span>
          )}
          {containerState.health && (
            <span
              className={cx('chip', {
                chipSuccess: containerState.health === 'healthy',
                chipWarning: containerState.health === 'unhealthy',
                chipGlass: containerState.health !== 'healthy' && containerState.health !== 'unhealthy',
              })}
            >
              Health: {containerState.health}
            </span>
          )}
        </div>
      )}

      {/* Both regions share one wrapper: a collapsed Collapse still occupies a flex slot at height 0,
          so leaving them as siblings of the header applied the root's `gap` twice. */}
      <div className={styles.regions}>
        <Collapse in={!expanded} mountOnEnter>
          <div className={cx(styles.summaryGrid, { [styles.compact]: compact })}>
            {summaryBars.map((bar) => (
              <UsageBar
                detail={bar.detail}
                icon={bar.icon}
                key={bar.key}
                label={bar.label}
                peak={bar.peak}
                value={bar.value}
              />
            ))}
          </div>
        </Collapse>

        <Collapse id={detailsId} in={expanded} mountOnEnter>
          <div className={styles.details}>
            {/* Only meaningful next to the "Per GPU" / "Throughput" headings it sits above — collapsed,
              there are no sibling sections for it to distinguish, so it rides the same toggle. */}
            <h5>General</h5>
            <div className={cx(styles.gaugesGrid, { [styles.compact]: compact })}>
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
                  centerLabel={cpuCenterLabel}
                  color="range"
                  dangerAt={DANGER_AT}
                  max={100}
                  min={0}
                  peak={cpuPeak}
                  peakLabel={percentLabel(cpuPeak)}
                  size={compact ? 'compact' : 'small'}
                  title={<GaugeTitle icon={<MemoryIcon className={styles.resourceIcon} />}>CPU</GaugeTitle>}
                  value={roundPercent(cpuValue)}
                  valueSuffix="%"
                  warnAt={WARN_AT}
                />
                {cpuName && <HardwareLabel className={styles.hardwareLabel} type="cpu" value={cpuName} />}
                {!compact && <Sparkline data={cpuHistory} metric="CPU" span={historySpan} />}
              </Card>

              {memValue !== undefined && (
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
                    centerLabel={`${formatBytes(memory.usageBytes)} / ${formatBytes(effectiveMemLimit as number)}`}
                    color="range"
                    dangerAt={DANGER_AT}
                    max={100}
                    min={0}
                    peak={memPeak}
                    peakLabel={percentLabel(memPeak)}
                    size={compact ? 'compact' : 'small'}
                    title={<GaugeTitle icon={<SdStorageIcon className={styles.resourceIcon} />}>Memory</GaugeTitle>}
                    value={roundPercent(memValue)}
                    valueSuffix="%"
                    warnAt={WARN_AT}
                  />
                  {!compact && <Sparkline data={memHistory} metric="Memory" span={historySpan} />}
                </Card>
              )}

              {diskValue !== undefined && (
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
                    centerLabel={`${formatBytes(disk.usedBytes)} / ${formatBytes(effectiveDiskQuota as number)}`}
                    color="range"
                    dangerAt={DANGER_AT}
                    max={100}
                    min={0}
                    peak={diskPeak}
                    peakLabel={percentLabel(diskPeak)}
                    size={compact ? 'compact' : 'small'}
                    title={<GaugeTitle icon={<DnsIcon className={styles.resourceIcon} />}>Disk</GaugeTitle>}
                    value={roundPercent(diskValue)}
                    valueSuffix="%"
                    warnAt={WARN_AT}
                  />
                  {!compact && <Sparkline data={diskHistory} metric="Disk" span={historySpan} />}
                </Card>
              )}

              {gpuVramValue !== undefined && (
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
                    centerLabel={`${formatBytes(gpuTotals.usedBytes)} / ${formatBytes(gpuTotals.totalBytes)}${
                      deviceCount > 1 ? ` · ${deviceCount} GPUs` : ''
                    }`}
                    color="range"
                    dangerAt={DANGER_AT}
                    label={
                      gpuAvgUtil !== undefined ? `${formatNumber(roundPercent(gpuAvgUtil))}% utilization` : undefined
                    }
                    max={100}
                    min={0}
                    peak={gpuVramPeak}
                    peakLabel={percentLabel(gpuVramPeak)}
                    size={compact ? 'compact' : 'small'}
                    title={<GaugeTitle icon={<GpuIcon className={styles.resourceIcon} />}>GPU VRAM</GaugeTitle>}
                    value={roundPercent(gpuVramValue)}
                    valueSuffix="%"
                    warnAt={WARN_AT}
                  />
                  {!compact && <Sparkline data={gpuVramHistory} metric="VRAM" span={historySpan} />}
                </Card>
              )}
            </div>

            {gpuRows.length > 0 && (
              <div className={cx(styles.gpuSection, { [styles.compact]: compact })}>
                <h5>Per GPU</h5>
                <div className={styles.gpuList}>
                  {gpuRows.map((row) => (
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
                        {row.util !== undefined && (
                          <UsageBar label="Utilization" peak={row.utilPeak} value={row.util} />
                        )}
                        {row.vram !== undefined && (
                          <UsageBar detail={row.vramDetail} label="VRAM" peak={row.vramPeak} value={row.vram} />
                        )}
                      </div>
                      {(row.shared || row.thermal) && (
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
            )}

            <div className={cx(styles.statsSection, { [styles.compact]: compact })}>
              <h5>Throughput &amp; processes</h5>
              <div className={styles.statsGrid}>
                {network && (
                  <StatPair
                    icon={<SwapVertIcon className={styles.resourceIcon} />}
                    label="Network"
                    rows={[
                      { key: '↓ in', value: formatBytes(network.rxBytes) },
                      { key: '↑ out', value: formatBytes(network.txBytes) },
                    ]}
                  />
                )}
                <StatPair
                  icon={<SwapHorizIcon className={styles.resourceIcon} />}
                  label="Disk I/O"
                  rows={[
                    { key: 'read', value: formatBytes(blockIO.readBytes) },
                    { key: 'write', value: formatBytes(blockIO.writeBytes) },
                  ]}
                />
                <Stat icon={<BoltIcon className={styles.resourceIcon} />} label="Processes">
                  {formatNumber(pids.current)}
                  <span className={styles.statValueMuted}> / {formatNumber(pids.limit)}</span>
                </Stat>
                <Stat icon={<TimerOutlinedIcon className={styles.resourceIcon} />} label="CPU time">
                  {formatCpuTime(cpu.cumulativeSeconds)}
                </Stat>
                {/* The gauges above only draw a ratio when a denominator exists; an unconstrained container
                still has to report what it's using, so it lands here as a plain reading instead. */}
                {memValue === undefined && (
                  <Stat icon={<SdStorageIcon className={styles.resourceIcon} />} label="Memory used">
                    {formatBytes(memory.usageBytes)}
                  </Stat>
                )}
                {diskValue === undefined && (
                  <Stat icon={<DnsIcon className={styles.resourceIcon} />} label="Disk used">
                    {formatBytes(disk.usedBytes)}
                    {effectiveDiskQuota && (
                      <span className={styles.statValueMuted}> / {formatBytes(effectiveDiskQuota)}</span>
                    )}
                  </Stat>
                )}
              </div>
            </div>
          </div>
        </Collapse>
      </div>
    </div>
  );
};

export default ResourceUsagePanel;
