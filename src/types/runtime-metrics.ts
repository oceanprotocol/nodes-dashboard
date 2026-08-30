/**
 * Runtime container metrics, as shipped by ocean-node (`src/@types/C2D/C2D.ts`, merged to `next-4`)
 * and typed by @oceanprotocol/lib >= 9.0.0-next.10 — re-exported here so call sites keep one import
 * for the type and the guard below, rather than duplicating the shape.
 *
 * The node samples Docker + NVML stats every `C2D_METRICS_INTERVAL_SECONDS` (default 10s; `0`
 * disables collection) and persists ONE latest snapshot per job/service as `runtimeMetrics`:
 *  - services (SERVICE_GET_STATUS) get it by default — the command is already owner-scoped, so
 *    ocean.js's `includeMetrics` is left unset;
 *  - compute jobs (COMPUTE_GET_STATUS) get it when the caller carries owner credentials, which an
 *    auth-token caller always does (see `useJobMetrics`).
 *
 * GPU numbers additionally depend on the node's `GPU_METRICS` ("auto" by default, "off" disables).
 * A node with metrics disabled simply omits the field, and a mismatched node could send anything
 * shaped like it — hence the guard below: every reader degrades to `null`, never throws.
 */
export type { ContainerMetricsSnapshot, GpuMetricsSnapshot } from '@oceanprotocol/lib';

import type { ContainerMetricsSnapshot } from '@oceanprotocol/lib';

/**
 * Defensive shape check for `job.runtimeMetrics` (or a raw compute-status entry) — absence is the
 * normal case (metrics disabled node-side, or no owner credentials), so this must never throw,
 * only narrow-or-null.
 */
export function getRuntimeMetrics(job: unknown): ContainerMetricsSnapshot | null {
  if (!job || typeof job !== 'object') {
    return null;
  }
  const metrics = (job as { runtimeMetrics?: unknown }).runtimeMetrics;
  if (!metrics || typeof metrics !== 'object') {
    return null;
  }
  const m = metrics as Record<string, any>;
  if (typeof m.collectedAt !== 'string') {
    return null;
  }
  if (!m.containerState || typeof m.containerState !== 'object' || typeof m.containerState.status !== 'string') {
    return null;
  }
  if (!m.cpu || typeof m.cpu !== 'object' || typeof m.cpu.usagePercent !== 'number') {
    return null;
  }
  if (!m.memory || typeof m.memory !== 'object' || typeof m.memory.usagePercent !== 'number') {
    return null;
  }
  if (!m.disk || typeof m.disk !== 'object') {
    return null;
  }
  if (!m.blockIO || typeof m.blockIO !== 'object') {
    return null;
  }
  if (!m.pids || typeof m.pids !== 'object') {
    return null;
  }
  return metrics as ContainerMetricsSnapshot;
}

/**
 * A client-side rollup of one snapshot — just the numbers a ring buffer of past samples needs for
 * sparklines and peak ticks, so callers aren't hoarding whole `ContainerMetricsSnapshot`s (with
 * their nested gpu arrays) per tick. Built with `sampleFromSnapshot` below.
 */
export interface UsageSample {
  collectedAt: string;
  cpuPercent: number;
  /** null when `cpu.allocated` is 0 (unconstrained) — there is no ratio to plot. */
  cpuPercentOfAllocated: number | null;
  memoryPercent: number;
  /** null when the node reported no quota AND no percentage — same "no ratio to plot" case as CPU.
   * The panel can still derive one from `diskUsedBytes` against a booked allocation. */
  diskPercent: number | null;
  /** Raw usage, so a caller holding a denominator the snapshot lacks (the booked disk size) can
   * compute the ratio the node didn't send. */
  diskUsedBytes: number;
  /** resourceId -> value, only for GPUs that reported a number (not null) that tick. */
  gpuUtilizationPercent: Record<string, number>;
  gpuMemoryPercent: Record<string, number>;
}

/** Disk saturation from whatever the node reported: its own percentage, else used/quota. `null` when
 * there's no quota at all — an unconstrained container has no ratio to plot. */
function diskPercentOf(disk: ContainerMetricsSnapshot['disk']): number | null {
  if (typeof disk.usagePercent === 'number') {
    return disk.usagePercent;
  }
  if (disk.quotaBytes && disk.quotaBytes > 0) {
    return (disk.usedBytes / disk.quotaBytes) * 100;
  }
  return null;
}

export function sampleFromSnapshot(snapshot: ContainerMetricsSnapshot): UsageSample {
  const gpuUtilizationPercent: Record<string, number> = {};
  const gpuMemoryPercent: Record<string, number> = {};
  (snapshot.gpu ?? []).forEach((gpu) => {
    if (typeof gpu.utilizationPercent === 'number') {
      gpuUtilizationPercent[gpu.resourceId] = gpu.utilizationPercent;
    }
    if (
      typeof gpu.memoryUsedBytes === 'number' &&
      typeof gpu.memoryTotalBytes === 'number' &&
      gpu.memoryTotalBytes > 0
    ) {
      gpuMemoryPercent[gpu.resourceId] = (gpu.memoryUsedBytes / gpu.memoryTotalBytes) * 100;
    }
  });
  return {
    collectedAt: snapshot.collectedAt,
    cpuPercent: snapshot.cpu.usagePercent,
    cpuPercentOfAllocated: snapshot.cpu.allocated > 0 ? snapshot.cpu.usagePercentOfAllocated : null,
    memoryPercent: snapshot.memory.usagePercent,
    // `usagePercent` is optional node-side even when a quota IS reported, so derive it from the two
    // byte counts when it's missing — requiring it left the disk sparkline stuck on "collecting…"
    // forever while the gauge (which derives the same way) drew a real value.
    diskPercent: diskPercentOf(snapshot.disk),
    diskUsedBytes: snapshot.disk.usedBytes,
    gpuUtilizationPercent,
    gpuMemoryPercent,
  };
}
