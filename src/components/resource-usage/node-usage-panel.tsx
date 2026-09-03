import GpuIcon from '@/assets/icons/gpu.svg';
import {
  aggregateGpu,
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
  envCpuCores,
  envDiskBytes,
  envGpuDevices,
  envRamBytes,
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
 * C2D containers sampled in the node's last tick.
 *
 * Every bar and arc therefore measures the C2D workloads against what the node OFFERS through its
 * compute environments (`env[]`, deduplicated per resource — see `envDiskBytes` and friends), which
 * is normally less than the machine: a real node advertises 123 of its 160 cores. Booked comes from
 * the same rows, so a fill and its tick always share one denominator. The machine's own figures are
 * real but answer a different question, so they sit below as plain stats next to load average.
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
  const cpuHistory = useMemo(
    () => history.map((sample) => sample.cpuPercent).filter((value): value is number => value !== undefined),
    [history]
  );
  const memHistory = useMemo(
    () => history.map((sample) => sample.memoryPercent).filter((value): value is number => value !== undefined),
    [history]
  );
  const diskHistory = useMemo(
    () =>
      history
        .map((sample) => sample.diskPercent)
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

  // BOOKED COMES FROM `env[]` FOR EVERY RESOURCE, and so does each fill's denominator.
  //
  // `env[]` is what consumers reserved through the marketplace; the cgroup fields
  // (`cpu.coresAllocated`, `memory.limitBytes`) are what the containers were actually granted. They
  // agree closely in practice (a real node: 31 cores booked, 31 allocated), but they answer different
  // questions, and mixing them across resources meant "booked" changed meaning from bar to bar.
  //
  // The denominators change with it: `env[]` totals are what the operator OFFERS, which is normally
  // less than the machine (that node advertises 123 of 160 cores, 1.6 of 2.2 TB). That is the honest
  // scale for "how booked is this node" — and the fill has to share it, or the tick lands in the
  // wrong place on its own track. The host figures stay visible as separate readings below.
  const cpuEnv = envCpuCores(metrics.env);
  const ramEnv = envRamBytes(metrics.env);
  const gpuEnv = envGpuDevices(metrics.env);
  const diskEnv = envDiskBytes(metrics.env);

  // usagePercent is docker-stats semantics summed over containers (100 == one busy core), so cores in
  // use is usagePercent / 100 — against cores OFFERED, not host cores.
  const cpuCoresUsed = cpu.usagePercent / 100;
  const cpuValue = hasWorkloadData && cpuEnv.total > 0 ? (cpuCoresUsed / cpuEnv.total) * 100 : undefined;
  const cpuCenterLabel = `${cpuCoresUsed.toFixed(1)} / ${formatNumber(cpuEnv.total)} cores`;
  const cpuPeak = cpuValue !== undefined ? resolvePeak(cpuValue, cpuHistory) : undefined;
  const cpuBooked = cpuValue !== undefined && cpuEnv.booked > 0 ? (cpuEnv.booked / cpuEnv.total) * 100 : undefined;

  // The containers' own consumption against RAM offered — not `hostTotal - hostFree`, which is the
  // whole machine's memory in use (OS and every other tenant included) and would put an unrelated
  // number on the same track as an Ocean booking.
  const memValue = hasWorkloadData && ramEnv.totalBytes > 0 ? (memory.usedBytes / ramEnv.totalBytes) * 100 : undefined;
  const memCenterLabel = `${formatBytes(memory.usedBytes)} / ${formatBytes(ramEnv.totalBytes)}`;
  const memPeak = memValue !== undefined ? resolvePeak(memValue, memHistory) : undefined;
  const memBooked =
    memValue !== undefined && ramEnv.bookedBytes > 0 ? (ramEnv.bookedBytes / ramEnv.totalBytes) * 100 : undefined;

  const gpuTotals = aggregateGpu(gpu);
  const gpuVramValue = gpuTotals.totalBytes > 0 ? (gpuTotals.usedBytes / gpuTotals.totalBytes) * 100 : undefined;
  const gpuAvgUtil = gpuTotals.utilCount > 0 ? gpuTotals.utilSum / gpuTotals.utilCount : undefined;
  const gpuVramPeak = gpuVramValue !== undefined ? resolvePeak(gpuVramValue, gpuVramHistory) : undefined;
  const gpuRows = buildGpuRows({ devices: gpu, hardwareNames, samples: history });
  const deviceCount = gpuRows.length;
  // The one resource whose booked share is a different QUANTITY from its fill: the bar measures VRAM
  // bytes, the tick counts whole devices reserved (each `gpuN` row is total 1, inUse 1 once booked).
  // Both are percentages of what the node offers, so they share the track honestly, but the hover has
  // to say "devices" or the tick reads as booked VRAM.
  const gpuBooked = gpuEnv.total > 0 && gpuEnv.booked > 0 ? (gpuEnv.booked / gpuEnv.total) * 100 : undefined;

  const diskValue =
    hasWorkloadData && diskEnv.totalBytes > 0 ? (disk.usedBytes / diskEnv.totalBytes) * 100 : undefined;
  const diskBooked =
    diskValue !== undefined && diskEnv.bookedBytes > 0 ? (diskEnv.bookedBytes / diskEnv.totalBytes) * 100 : undefined;
  const diskPeak = diskValue !== undefined ? resolvePeak(diskValue, diskHistory) : undefined;
  const diskCenterLabel = `${formatBytes(disk.usedBytes)} / ${formatBytes(diskEnv.totalBytes)}`;

  // GPU first: it is why a consumer picks one node over another, and on a rig the VRAM bar is the
  // reading that decides whether a job fits at all. CPU, memory and disk follow.
  //
  // These bars carry ONE tick and it always means booked, now on every one of the four — every figure
  // comes from `env[]`, against the same offered-capacity denominator as its own fill. The session
  // peak is on the gauges in "More info" instead, where a tick can only mean one thing.
  const summaryBars: {
    booked?: number;
    bookedTitle?: string;
    detail?: string;
    icon: React.ReactNode;
    key: string;
    label: string;
    value: number;
  }[] = [];
  if (gpuVramValue !== undefined) {
    summaryBars.push({
      booked: gpuBooked,
      // Spelled out as devices, because this is the one tick that measures something other than its
      // own bar: the fill is VRAM bytes, the tick is whole GPUs reserved.
      bookedTitle:
        gpuBooked === undefined
          ? undefined
          : `booked: ${formatNumber(roundPercent(gpuBooked))}% · ${formatNumber(gpuEnv.booked)} of ${formatNumber(
              gpuEnv.total
            )} GPUs reserved`,
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
          : `booked: ${formatNumber(roundPercent(cpuBooked))}% · ${formatNumber(cpuEnv.booked)} of ${formatNumber(
              cpuEnv.total
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
              ramEnv.bookedBytes
            )} of ${formatBytes(ramEnv.totalBytes)} reserved`,
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
              diskEnv.bookedBytes
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
            {/* The whole machine, not Ocean's share of it: os.totalmem/os.freemem count every process
                on the box. The gauges above deliberately measure against what the node offers, so
                this is the only place the machine's own figure appears. */}
            {memory.hostTotalBytes > 0 && (
              <Stat icon={<SdStorageIcon className={resourceIconClass} />} label="Machine memory">
                {formatBytes(Math.max(0, memory.hostTotalBytes - memory.hostFreeBytes))}
                <StatMuted> / {formatBytes(memory.hostTotalBytes)}</StatMuted>
              </Stat>
            )}
            {cpu.hostCores > 0 && (
              <Stat icon={<MemoryIcon className={resourceIconClass} />} label="Machine cores">
                {formatNumber(cpu.hostCores)}
                {cpuEnv.total > 0 && <StatMuted> · {formatNumber(cpuEnv.total)} offered</StatMuted>}
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
