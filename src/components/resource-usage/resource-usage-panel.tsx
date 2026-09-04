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
import { ContainerMetricsSnapshot, UsageSample } from '@/types/runtime-metrics';
import { formatBytes, formatNumber } from '@/utils/formatters';
import BoltIcon from '@mui/icons-material/Bolt';
import DnsIcon from '@mui/icons-material/Dns';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import Tooltip from '@mui/material/Tooltip';
import cx from 'classnames';
import { useMemo } from 'react';

// Docker's CFS accounting reports a stray throttled period now and then on a container that is
// nowhere near its quota, so "throttledPeriods > 0" is background noise, not a condition worth
// warning about — a container using 0.2% of its cores was never actually held back. Only a full
// second of accumulated throttling means the workload genuinely lost CPU it asked for.
const THROTTLE_FLOOR_SECONDS = 1;

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
  const secondsAgo = secondsSince(metrics.collectedAt);
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
  const historySpan = formatSpan(history.map((sample) => sample.collectedAt));

  // GPU rows — a device is one row (name + utilization bar + VRAM bar), not two arcs, so a booking
  // with eight devices stays a scannable list. Temp/power ride along as row meta instead of chips at
  // the bottom, which lost track of which device they belonged to once there was more than one.
  const gpuRows = buildGpuRows({ devices: gpu ?? [], hardwareNames, samples: history });

  // One primary GPU gauge beside CPU/memory/disk, so the top row answers "how loaded is this box"
  // across all four resource kinds. The arc is aggregate VRAM rather than utilization: VRAM is the
  // hard ceiling for an inference workload (out of VRAM = the model won't load), while utilization
  // swings 0-100% between requests and reads 0% on an idle-but-fully-loaded service. Utilization
  // still shows as the center label, and per-device detail is in the rows below.
  const gpuTotals = aggregateGpu(gpu ?? []);
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
  // GPU, CPU, memory, then disk — the accelerator is the reason a GPU workload is on this node at
  // all, and disk is the slowest-moving of the four, so it reads last. Same order in the gauge grid
  // below and in the node-wide panel, so nothing reshuffles between the two views or the two panels.
  //
  // No peak ticks on these bars. A tick on a summary bar means "booked" across both panels (see the
  // node panel's summaryBars), and this container's fills are already drawn against its own booked
  // quota — a tick would mark the 100% end of its own track. The peaks are on the gauges below.
  const summaryBars: {
    key: string;
    label: string;
    value: number;
    detail?: string;
    icon: React.ReactNode;
  }[] = [];
  if (gpuVramValue !== undefined) {
    summaryBars.push({
      key: 'vram',
      label: deviceCount > 1 ? `GPU VRAM · ${deviceCount} devices` : 'GPU VRAM',
      value: gpuVramValue,
      detail: `${formatBytes(gpuTotals.usedBytes)} / ${formatBytes(gpuTotals.totalBytes)}`,
      icon: <GpuIcon className={resourceIconClass} />,
    });
  }
  summaryBars.push({
    key: 'cpu',
    label: 'CPU',
    value: cpuValue,
    detail: cpuCenterLabel,
    icon: <MemoryIcon className={resourceIconClass} />,
  });
  if (memValue !== undefined) {
    summaryBars.push({
      key: 'memory',
      label: 'Memory',
      value: memValue,
      detail: `${formatBytes(memory.usageBytes)} / ${formatBytes(effectiveMemLimit as number)}`,
      icon: <SdStorageIcon className={resourceIconClass} />,
    });
  }
  if (diskValue !== undefined) {
    summaryBars.push({
      key: 'disk',
      label: 'Disk',
      value: diskValue,
      detail: `${formatBytes(disk.usedBytes)} / ${formatBytes(effectiveDiskQuota as number)}`,
      icon: <DnsIcon className={resourceIconClass} />,
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
    <UsagePanelShell
      compact={compact}
      defaultExpanded={defaultExpanded}
      details={
        <>
          {/* Only meaningful next to the "Per GPU" / "Throughput" headings it sits above — collapsed,
              there are no sibling sections for it to distinguish, so it rides the same toggle. */}
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

            <UsageGaugeCard
              centerLabel={cpuCenterLabel}
              compact={compact}
              hardwareName={cpuName}
              icon={<MemoryIcon className={resourceIconClass} />}
              peak={cpuPeak}
              sparkline={{ data: cpuHistory, metric: 'CPU', span: historySpan }}
              title="CPU"
              value={cpuValue}
            />

            {memValue !== undefined && (
              <UsageGaugeCard
                centerLabel={`${formatBytes(memory.usageBytes)} / ${formatBytes(effectiveMemLimit as number)}`}
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
                centerLabel={`${formatBytes(disk.usedBytes)} / ${formatBytes(effectiveDiskQuota as number)}`}
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

          <UsageStatsSection compact={compact} heading="Throughput &amp; processes">
            {network && (
              <StatPair
                icon={<SwapVertIcon className={resourceIconClass} />}
                label="Network"
                rows={[
                  { key: '↓ in', value: formatBytes(network.rxBytes) },
                  { key: '↑ out', value: formatBytes(network.txBytes) },
                ]}
              />
            )}
            <StatPair
              icon={<SwapHorizIcon className={resourceIconClass} />}
              label="Disk I/O"
              rows={[
                { key: 'read', value: formatBytes(blockIO.readBytes) },
                { key: 'write', value: formatBytes(blockIO.writeBytes) },
              ]}
            />
            <Stat icon={<BoltIcon className={resourceIconClass} />} label="Processes">
              {formatNumber(pids.current)}
              <StatMuted> / {formatNumber(pids.limit)}</StatMuted>
            </Stat>
            <Stat icon={<TimerOutlinedIcon className={resourceIconClass} />} label="CPU time">
              {formatCpuTime(cpu.cumulativeSeconds)}
            </Stat>
            {/* The gauges above only draw a ratio when a denominator exists; an unconstrained container
                still has to report what it's using, so it lands here as a plain reading instead. */}
            {memValue === undefined && (
              <Stat icon={<SdStorageIcon className={resourceIconClass} />} label="Memory used">
                {formatBytes(memory.usageBytes)}
              </Stat>
            )}
            {diskValue === undefined && (
              <Stat icon={<DnsIcon className={resourceIconClass} />} label="Disk used">
                {formatBytes(disk.usedBytes)}
                {effectiveDiskQuota && <StatMuted> / {formatBytes(effectiveDiskQuota)}</StatMuted>}
              </Stat>
            )}
          </UsageStatsSection>
        </>
      }
      freshness={freshnessText}
      signals={
        hasSignals ? (
          <>
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
          </>
        ) : null
      }
      summary={
        <UsageSummaryGrid compact={compact}>
          {summaryBars.map((bar) => (
            <UsageBar detail={bar.detail} icon={bar.icon} key={bar.key} label={bar.label} value={bar.value} />
          ))}
        </UsageSummaryGrid>
      }
      title={title}
    />
  );
};

export default ResourceUsagePanel;
