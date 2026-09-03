import GpuIcon from '@/assets/icons/gpu.svg';
import {
  aggregateGpu,
  bookedDiskBytes,
  buildGpuRows,
  formatFreshness,
  formatSpan,
  resolvePeak,
  roundPercent,
  secondsSince,
} from '@/components/resource-usage/usage-metrics';
import UsagePanelShell from '@/components/resource-usage/usage-panel-shell';
import {
  GpuDeviceSection,
  resourceIconClass,
  Stat,
  StatMuted,
  StatPair,
  UsageBar,
  UsageGaugeCard,
  UsageGaugeGrid,
  UsageStatsSection,
  UsageSummaryGrid,
} from '@/components/resource-usage/usage-primitives';
import {
  advertisedDiskBytes,
  cpuPercentOfHost,
  hostMemoryPercent,
  NodeMetricsSnapshot,
  NodeUsageSample,
} from '@/types/node-metrics';
import { formatBytes, formatNumber } from '@/utils/formatters';
import BoltIcon from '@mui/icons-material/Bolt';
import DnsIcon from '@mui/icons-material/Dns';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LayersIcon from '@mui/icons-material/Layers';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import SpeedIcon from '@mui/icons-material/Speed';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import Tooltip from '@mui/material/Tooltip';
import { useMemo } from 'react';

// `meta.oldestSampleAgeSeconds` is normally at most C2D_METRICS_INTERVAL_SECONDS (10s by default),
// so anything past a minute means the sampler is stuck rather than merely between ticks — the point
// at which these readings stop describing "now".
const STALE_SAMPLE_FLOOR_SECONDS = 60;

export interface NodeUsagePanelProps {
  /** Start expanded. Default (`false`) opens on the bars. */
  defaultExpanded?: boolean;
  /**
   * resourceId -> hardware name, merged from every compute environment's resource descriptions
   * (`gpu0` -> "NVIDIA H200", `cpu` -> "AMD EPYC 9634"). The metrics payload carries only opaque ids.
   */
  hardwareNames?: Record<string, string>;
  /** Client-side ring buffer from `useNodeUsageSamples` — powers peak ticks and the sparklines. */
  history?: NodeUsageSample[];
  metrics: NodeMetricsSnapshot | null;
  title?: React.ReactNode;
  /** `page` shows sparklines; `compact` omits them. Same rule as ResourceUsagePanel. */
  variant?: 'page' | 'compact';
}

/**
 * The node-wide sibling of `ResourceUsagePanel`: same shell, same gauges, same bars, different
 * denominators. Renders nothing when `metrics` is null — the call site owns its own empty-state copy.
 *
 * The one thing this panel has to keep straight is WHOSE numbers it draws. Only hostCores,
 * loadAverage and host free/total memory describe the machine; every other scalar is a sum over the
 * C2D containers sampled in the node's last tick. So the arcs are "CPU" (what the workloads take of
 * the machine) and "Memory" (what the machine has left), while the workload memory /
 * traffic readings sit below as plain stats, where no ratio would be honest.
 */
const NodeUsagePanel: React.FC<NodeUsagePanelProps> = ({
  defaultExpanded = false,
  hardwareNames,
  history = [],
  metrics,
  title,
  variant = 'page',
}) => {
  const compact = variant === 'compact';
  const cpuHistory = useMemo(() => history.map((sample) => sample.cpuPercentOfHost), [history]);
  const memHistory = useMemo(() => history.map((sample) => sample.memoryPercentOfHost), [history]);
  const diskHistory = useMemo(
    () =>
      history
        .map((sample) => sample.diskPercentOfAdvertised)
        .filter((value): value is number => value !== undefined),
    [history]
  );
  const gpuVramHistory = useMemo(
    () =>
      history
        .map((sample) => {
          const values = Object.values(sample.gpuMemoryPercent);
          return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
        })
        .filter((value): value is number => value !== undefined),
    [history]
  );

  if (!metrics) {
    return null;
  }

  const { cpu, disk, gpu, jobs, memory, meta, network } = metrics;
  const freshnessText = `Updated ${formatFreshness(secondsSince(metrics.collectedAt))}`;
  const historySpan = formatSpan(history.map((sample) => sample.collectedAt));

  // With no fresh aggregate every container-derived scalar is a structural zero. Drawing "0.0 / 8
  // cores" would claim an idle node when the truth is that nothing is being measured, so those
  // readings are dropped entirely and a chip says why. The host fields stay: they are still real.
  const hasWorkloadData = metrics.hasAggregate;

  const cpuValue = hasWorkloadData ? cpuPercentOfHost(cpu) : undefined;
  const cpuCenterLabel = `${(cpu.usagePercent / 100).toFixed(1)} / ${formatNumber(cpu.hostCores)} cores`;
  const cpuPeak = cpuValue !== undefined ? resolvePeak(cpuValue, cpuHistory) : undefined;
  // Cores RESERVED by the running containers, on the same percent-of-host scale as the fill. Held
  // whether or not the workloads are burning them, so a fill far short of this tick is booked-but-idle
  // capacity — the reading an operator uses to decide the node is oversold rather than busy.
  const cpuBooked =
    hasWorkloadData && cpu.hostCores && cpu.coresAllocated > 0
      ? (cpu.coresAllocated / cpu.hostCores) * 100
      : undefined;

  const hostMemUsedBytes = Math.max(0, memory.hostTotalBytes - memory.hostFreeBytes);
  const memValue = hostMemoryPercent(memory);
  const memCenterLabel = `${formatBytes(hostMemUsedBytes)} / ${formatBytes(memory.hostTotalBytes)}`;
  const memPeak = memValue !== undefined ? resolvePeak(memValue, memHistory) : undefined;
  // The containers' own memory limits against host RAM. Note the two numbers on this bar come from
  // different places: the fill is the WHOLE machine's memory in use (os.freemem, which includes
  // everything else running on the box), while the tick is only what C2D booked — so the tick can sit
  // below a high fill without contradicting it.
  const memBooked =
    hasWorkloadData && memory.hostTotalBytes && memory.limitBytes > 0
      ? (memory.limitBytes / memory.hostTotalBytes) * 100
      : undefined;

  const gpuTotals = aggregateGpu(gpu);
  const gpuVramValue = gpuTotals.totalBytes > 0 ? (gpuTotals.usedBytes / gpuTotals.totalBytes) * 100 : undefined;
  const gpuAvgUtil = gpuTotals.utilCount > 0 ? gpuTotals.utilSum / gpuTotals.utilCount : undefined;
  const gpuVramPeak = gpuVramValue !== undefined ? resolvePeak(gpuVramValue, gpuVramHistory) : undefined;
  const gpuRows = buildGpuRows({ devices: gpu, hardwareNames, samples: history });
  const deviceCount = gpuRows.length;

  // Workload disk against what the node ADVERTISES across its environments — see `advertisedDiskBytes`
  // for why that is the only denominator available and what it does not claim to be. With no disk rows
  // in `env[]` there is no ratio to draw, and the reading falls back to the plain byte stat below.
  const diskTotalBytes = advertisedDiskBytes(metrics.env);
  const diskBookedBytes = bookedDiskBytes(metrics.env);
  const diskValue = hasWorkloadData && diskTotalBytes > 0 ? (disk.usedBytes / diskTotalBytes) * 100 : undefined;
  const diskBooked =
    diskValue !== undefined && diskBookedBytes > 0 ? (diskBookedBytes / diskTotalBytes) * 100 : undefined;
  const diskPeak = diskValue !== undefined ? resolvePeak(diskValue, diskHistory) : undefined;
  const diskCenterLabel = `${formatBytes(disk.usedBytes)} / ${formatBytes(diskTotalBytes)}`;

  // GPU first: it is why a consumer picks one node over another, and on a rig the VRAM bar is the
  // reading that decides whether a job fits at all. CPU, host memory and disk follow.
  //
  // These bars carry ONE tick and it always means booked. They used to also mark the session peak,
  // but both ticks draw identically, so a bar with two of them couldn't say which was which — and
  // VRAM, which has no booked figure on the wire, showed a lone tick that read as booked and wasn't.
  // The peak is still on the gauges in "More info", where it's the only thing a tick could mean.
  const summaryBars: {
    booked?: number;
    bookedTitle?: string;
    detail?: string;
    icon: React.ReactNode;
    key: string;
    label: string;
    value: number;
  }[] = [];
  // No tick: the snapshot carries no reserved-VRAM figure. `env[]` counts whole devices in use, a
  // different denominator — drawing that here would be inventing a number.
  if (gpuVramValue !== undefined) {
    summaryBars.push({
      detail: `${formatBytes(gpuTotals.usedBytes)} / ${formatBytes(gpuTotals.totalBytes)}`,
      icon: <GpuIcon className={resourceIconClass} />,
      key: 'vram',
      label: deviceCount > 1 ? `GPU VRAM · ${deviceCount} devices` : 'GPU VRAM',
      value: gpuVramValue,
    });
  }
  if (cpuValue !== undefined) {
    summaryBars.push({
      booked: cpuBooked,
      bookedTitle:
        cpuBooked === undefined
          ? undefined
          : `booked: ${formatNumber(roundPercent(cpuBooked))}% · ${formatNumber(cpu.coresAllocated)} of ${formatNumber(
              cpu.hostCores
            )} cores reserved`,
      detail: cpuCenterLabel,
      icon: <MemoryIcon className={resourceIconClass} />,
      key: 'cpu',
      label: 'CPU',
      value: cpuValue,
    });
  }
  if (memValue !== undefined) {
    summaryBars.push({
      booked: memBooked,
      bookedTitle:
        memBooked === undefined
          ? undefined
          : `booked: ${formatNumber(roundPercent(memBooked))}% · ${formatBytes(
              memory.limitBytes
            )} reserved by workloads`,
      detail: memCenterLabel,
      icon: <SdStorageIcon className={resourceIconClass} />,
      key: 'memory',
      label: 'Memory',
      value: memValue,
    });
  }
  if (diskValue !== undefined) {
    summaryBars.push({
      booked: diskBooked,
      bookedTitle:
        diskBooked === undefined
          ? undefined
          : `booked: ${formatNumber(roundPercent(diskBooked))}% · ${formatBytes(
              diskBookedBytes
            )} reserved across environments`,
      // "advertised", not "capacity": environments sharing a filesystem each report their own total.
      detail: `${diskCenterLabel} advertised`,
      icon: <DnsIcon className={resourceIconClass} />,
      key: 'disk',
      label: 'Disk',
      value: diskValue,
    });
  }

  const isStaleSample = hasWorkloadData && meta.oldestSampleAgeSeconds > STALE_SAMPLE_FLOOR_SECONDS;
  // No throttling chip here, unlike the container panel. `cpu.throttledCount` counts OTHER tenants'
  // containers hitting their own cgroup limits — a normal condition of a busy node, not a fault in
  // it, and nothing a reader deciding whether to book this node can act on. It stays in
  // `ResourceUsagePanel`, where the throttled container is the reader's own job.
  const hasSignals = !hasWorkloadData || isStaleSample;

  // 1m/5m/15m, but the array can be shorter than three on some platforms.
  const loadRows = ['1m', '5m', '15m']
    .map((key, index) => ({ key, value: cpu.loadAverage?.[index] }))
    .filter((row): row is { key: string; value: number } => typeof row.value === 'number')
    .map((row) => ({ key: row.key, value: row.value.toFixed(2) }));

  return (
    <UsagePanelShell
      compact={compact}
      defaultExpanded={defaultExpanded}
      details={
        <>
          <h5>General</h5>
          <UsageGaugeGrid compact={compact}>
            {gpuVramValue !== undefined && (
              <UsageGaugeCard
                centerLabel={`${formatBytes(gpuTotals.usedBytes)} / ${formatBytes(gpuTotals.totalBytes)}${
                  deviceCount > 1 ? ` · ${deviceCount} GPUs` : ''
                }`}
                compact={compact}
                icon={<GpuIcon className={resourceIconClass} />}
                label={gpuAvgUtil !== undefined ? `${formatNumber(roundPercent(gpuAvgUtil))}% utilization` : undefined}
                peak={gpuVramPeak}
                sparkline={{ data: gpuVramHistory, metric: 'VRAM', span: historySpan }}
                title="GPU VRAM"
                value={gpuVramValue}
              />
            )}

            {cpuValue !== undefined && (
              <UsageGaugeCard
                centerLabel={cpuCenterLabel}
                compact={compact}
                hardwareName={hardwareNames?.cpu}
                icon={<MemoryIcon className={resourceIconClass} />}
                peak={cpuPeak}
                sparkline={{ data: cpuHistory, metric: 'CPU', span: historySpan }}
                title="CPU"
                value={cpuValue}
              />
            )}

            {memValue !== undefined && (
              <UsageGaugeCard
                centerLabel={memCenterLabel}
                compact={compact}
                icon={<SdStorageIcon className={resourceIconClass} />}
                peak={memPeak}
                sparkline={{ data: memHistory, metric: 'Memory', span: historySpan }}
                title="Memory"
                value={memValue}
              />
            )}

            {diskValue !== undefined && (
              <UsageGaugeCard
                centerLabel={diskCenterLabel}
                compact={compact}
                icon={<DnsIcon className={resourceIconClass} />}
                peak={diskPeak}
                sparkline={{ data: diskHistory, metric: 'Disk', span: historySpan }}
                title="Disk"
                value={diskValue}
              />
            )}
          </UsageGaugeGrid>

          {gpuRows.length > 0 && <GpuDeviceSection compact={compact} rows={gpuRows} />}

          <UsageStatsSection compact={compact} heading="Workloads &amp; host">
            {hasWorkloadData && (
              <Stat icon={<BoltIcon className={resourceIconClass} />} label="Running jobs">
                {formatNumber(jobs.running)}
                <StatMuted> · {formatNumber(jobs.runningFree)} free</StatMuted>
              </Stat>
            )}
            {hasWorkloadData && (
              <Stat icon={<HourglassEmptyIcon className={resourceIconClass} />} label="Queued jobs">
                {formatNumber(jobs.queued)}
                <StatMuted> · {formatNumber(jobs.queuedFree)} free</StatMuted>
              </Stat>
            )}
            {loadRows.length > 0 && (
              <StatPair icon={<SpeedIcon className={resourceIconClass} />} label="Load average" rows={loadRows} />
            )}
            {hasWorkloadData && (
              <Stat icon={<SdStorageIcon className={resourceIconClass} />} label="Workload memory">
                {formatBytes(memory.usedBytes)}
                {memory.limitBytes > 0 && <StatMuted> / {formatBytes(memory.limitBytes)}</StatMuted>}
              </Stat>
            )}
            {/* Only when the environments advertise no disk total: with one, the reading is already a
                bar above, and repeating it here reads as a second, different number. */}
            {hasWorkloadData && diskValue === undefined && (
              <Stat icon={<DnsIcon className={resourceIconClass} />} label="Disk">
                {formatBytes(disk.usedBytes)}
              </Stat>
            )}
            {hasWorkloadData && (
              <StatPair
                icon={<SwapVertIcon className={resourceIconClass} />}
                label="Network"
                rows={[
                  { key: '↓ in', value: formatBytes(network.rxBytes) },
                  { key: '↑ out', value: formatBytes(network.txBytes) },
                ]}
              />
            )}
            {hasWorkloadData && (
              <Stat icon={<LayersIcon className={resourceIconClass} />} label="Containers sampled">
                {formatNumber(meta.sampledContainers)}
              </Stat>
            )}
          </UsageStatsSection>
        </>
      }
      freshness={freshnessText}
      signals={
        hasSignals ? (
          <>
            {!hasWorkloadData && (
              <Tooltip title="This node isn't sampling its containers right now (compute metrics collection is off, or no compute engine has reported yet), so only its host readings are shown.">
                <span className="chip chipGlass">Workload metrics off</span>
              </Tooltip>
            )}
            {isStaleSample && (
              <Tooltip title="The node's container sampler hasn't produced a fresh reading recently, so the workload numbers below may lag behind what is actually running.">
                <span className="chip chipWarning">Sample {formatFreshness(meta.oldestSampleAgeSeconds)}</span>
              </Tooltip>
            )}
          </>
        ) : null
      }
      summary={
        <UsageSummaryGrid compact={compact}>
          {summaryBars.map((bar) => (
            <UsageBar
              booked={bar.booked}
              bookedTitle={bar.bookedTitle}
              detail={bar.detail}
              icon={bar.icon}
              key={bar.key}
              label={bar.label}
              value={bar.value}
            />
          ))}
        </UsageSummaryGrid>
      }
      title={title}
    />
  );
};

export default NodeUsagePanel;
