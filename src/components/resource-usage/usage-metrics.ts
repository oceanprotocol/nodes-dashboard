/**
 * Pure math shared by the container usage panel (`resource-usage-panel`) and the node one
 * (`node-usage-panel`). No JSX and no stylesheet import, so a caller can pull a derivation without
 * pulling the CSS module along with it.
 */
import { formatBytes, formatNumber } from '@/utils/formatters';

// Saturation thresholds shared by every bounded gauge here — "your allocation is too small" starts
// to matter well before 100%, and this keeps CPU/memory/disk/GPU reading the same color language.
export const WARN_AT = 85;
export const DANGER_AT = 95;

// A tick is only worth drawing when it's meaningfully above the current reading — right on top of
// it just adds visual noise, and it needs at least one other sample to be a "peak" at all.
export function resolvePeak(current: number, values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const max = Math.max(current, ...values);
  return max - current >= 1 ? max : undefined;
}

/** Peak-tick tooltip text, or undefined when there's no peak worth marking. */
export function percentLabel(value: number | undefined): string | undefined {
  return value === undefined ? undefined : `${formatNumber(Math.round(value))}%`;
}

/** One decimal is all a saturation reading carries — raw ratios arrive as 91.66666…%. */
export function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatFreshness(seconds: number): string {
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

/**
 * Container snapshots stamp `collectedAt` as an ISO string; node snapshots use epoch ms. One helper
 * so neither panel has to remember which shape it holds.
 */
export function toEpochMs(collectedAt: string | number): number {
  return typeof collectedAt === 'number' ? collectedAt : new Date(collectedAt).getTime();
}

export function secondsSince(collectedAt: string | number): number {
  return Math.max(0, Math.round((Date.now() - toEpochMs(collectedAt)) / 1000));
}

/**
 * How much wall-clock the ring buffer currently covers — labels the sparkline honestly, since the
 * span depends on poll cadence (4s for services, 15s for jobs, 20s for a node) and on how long the
 * view has been open.
 */
export function formatSpan(collectedAts: (string | number)[]): string {
  if (collectedAts.length < 2) {
    return '—';
  }
  const seconds = Math.max(
    0,
    Math.round((toEpochMs(collectedAts[collectedAts.length - 1]) - toEpochMs(collectedAts[0])) / 1000)
  );
  if (seconds < 90) {
    return `${seconds}s`;
  }
  return `${Math.round(seconds / 60)}m`;
}

/**
 * Structural superset of `GpuMetricsSnapshot` (per container, carries `shared`) and `NodeMetricsGpu`
 * (per node, doesn't). Every numeric field is optional per device AND per sample — the collector
 * omits whatever it couldn't read from NVML.
 */
export type GpuDeviceLike = {
  memoryTotalBytes?: number | null;
  memoryUsedBytes?: number | null;
  powerWatts?: number | null;
  resourceId: string;
  shared?: boolean | null;
  temperatureC?: number | null;
  utilizationPercent?: number | null;
  vendor?: string | null;
};

/**
 * Aggregate VRAM and mean utilization across devices, so the single primary GPU arc is computed the
 * same way in both panels. The arc is VRAM rather than utilization because VRAM is the hard ceiling
 * for an inference workload (out of VRAM = the model won't load), while utilization swings 0-100%
 * between requests and reads 0% on an idle-but-fully-loaded box.
 */
export function aggregateGpu(devices: GpuDeviceLike[]): {
  totalBytes: number;
  usedBytes: number;
  utilCount: number;
  utilSum: number;
} {
  return (devices ?? []).reduce(
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
    { totalBytes: 0, usedBytes: 0, utilCount: 0, utilSum: 0 }
  );
}

export interface GpuDeviceRow {
  name?: string;
  resourceId: string;
  shared: boolean;
  thermal: string;
  util?: number;
  utilPeak?: number;
  vram?: number;
  vramDetail?: string;
  vramPeak?: number;
}

/**
 * A device is one row (name + utilization bar + VRAM bar), not two arcs, so a rig with eight devices
 * stays a scannable list. `samples` is either panel's ring buffer — both key their per-GPU history by
 * `resourceId`, so the peak ticks come out of the same code.
 */
export function buildGpuRows({
  devices,
  hardwareNames,
  samples,
}: {
  devices: GpuDeviceLike[];
  hardwareNames?: Record<string, string>;
  samples: { gpuMemoryPercent: Record<string, number>; gpuUtilizationPercent: Record<string, number> }[];
}): GpuDeviceRow[] {
  return (devices ?? [])
    .map((device) => {
      const hasVram =
        typeof device.memoryUsedBytes === 'number' &&
        typeof device.memoryTotalBytes === 'number' &&
        device.memoryTotalBytes > 0;
      const util = typeof device.utilizationPercent === 'number' ? device.utilizationPercent : undefined;
      const vram = hasVram
        ? ((device.memoryUsedBytes as number) / (device.memoryTotalBytes as number)) * 100
        : undefined;
      const utilHistory = samples
        .map((sample) => sample.gpuUtilizationPercent[device.resourceId])
        .filter((value): value is number => value !== undefined);
      const vramHistory = samples
        .map((sample) => sample.gpuMemoryPercent[device.resourceId])
        .filter((value): value is number => value !== undefined);
      const thermal = [
        typeof device.temperatureC === 'number' ? `${Math.round(device.temperatureC)}°C` : null,
        typeof device.powerWatts === 'number' ? `${Math.round(device.powerWatts)}W` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      // HardwareLabel turns "NVIDIA H200" into a logo + "H200"; with no description from the
      // environment, the vendor alone still gets the right logo (the id is shown as meta anyway).
      const name = hardwareNames?.[device.resourceId] || device.vendor || undefined;
      return {
        name,
        resourceId: device.resourceId,
        shared: Boolean(device.shared),
        thermal,
        util,
        utilPeak: util !== undefined ? resolvePeak(util, utilHistory) : undefined,
        vram,
        vramDetail: hasVram
          ? `${formatBytes(device.memoryUsedBytes as number)} / ${formatBytes(device.memoryTotalBytes as number)}`
          : undefined,
        vramPeak: vram !== undefined ? resolvePeak(vram, vramHistory) : undefined,
      };
    })
    .filter((row) => row.util !== undefined || row.vram !== undefined);
}
