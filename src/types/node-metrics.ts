/**
 * Per-node resource metrics from ocean-node >= 4.1.0 (`src/@types/nodeMetrics.ts`, PR #1462).
 * @oceanprotocol/lib 9.0.0 ships no type and no wrapper for `getNodeMetrics` /
 * `getNodeMetricsHistory`, so the shapes are mirrored by hand — delete them the day the lib exports
 * them, and keep the guards either way (a node on a build we don't know about can send anything
 * shaped like this).
 *
 * WHAT IS AND ISN'T HOST-WIDE — the distinction the whole panel is built around. Only four fields
 * describe the machine: `cpu.hostCores` (os.cpus().length), `cpu.loadAverage` (os.loadavg(), live
 * snapshot only), `memory.hostFreeBytes` and `memory.hostTotalBytes` (os.freemem/os.totalmem).
 * EVERYTHING else — cpu.usagePercent/coresAllocated/throttledCount, memory.usedBytes/limitBytes,
 * disk, network, jobs, gpu[], meta — is a sum over the C2D containers sampled in the node's last
 * metrics tick. That is workload usage, not host usage, and there is no host disk figure at all.
 */

export interface NodeMetricsGpu {
  memoryTotalBytes?: number;
  memoryUsedBytes?: number;
  powerWatts?: number;
  resourceId: string;
  temperatureC?: number;
  utilizationPercent?: number;
  vendor?: string;
}

/**
 * `env` is the compute environment id; a `<envId>:free` key is that environment's free-tier pool, a
 * distinct pool with the same resource ids. Units follow /computeEnvironments: cpu = cores, ram =
 * GB, disk = GB, discrete resources = device count. Unused by the panel today (the Environments card
 * on the same page already renders capacity) — kept so the type stays faithful to the wire.
 */
export interface NodeMetricsEnvResource {
  env: string;
  inUse: number;
  resource: string;
  total: number;
}

export interface NodeMetricsSnapshot {
  /** Epoch ms. The container snapshot's `collectedAt` is an ISO string — they are not the same. */
  collectedAt: number;
  cpu: {
    coresAllocated: number;
    hostCores: number;
    /** [1m, 5m, 15m] host load. May be shorter than 3, and is absent from hourly buckets. */
    loadAverage: number[];
    /** COUNT of sampled containers that hit a cgroup throttle, not a period or second count. */
    throttledCount: number;
    /** docker-stats semantics summed over containers: 100 == one busy core, range 0..hostCores*100. */
    usagePercent: number;
  };
  disk: { usedBytes: number };
  env: NodeMetricsEnvResource[];
  gpu: NodeMetricsGpu[];
  /**
   * false means NO engine had a fresh aggregate, so every container-derived scalar is a structural
   * zero rather than a reading. true with `meta.sampledContainers === 0` is the normal idle state.
   */
  hasAggregate: boolean;
  jobs: { queued: number; queuedFree: number; running: number; runningFree: number };
  memory: { hostFreeBytes: number; hostTotalBytes: number; limitBytes: number; usedBytes: number };
  meta: { oldestSampleAgeSeconds: number; sampledContainers: number };
  /**
   * Per-container CUMULATIVE counters summed over the containers alive this tick, so the total FALLS
   * when a job ends. Never diff these into a rate.
   */
  network: { rxBytes: number; txBytes: number };
}

/**
 * One hourly bucket. Every scalar is an arithmetic MEAN over that hour's minute samples, so
 * integer-looking fields come back fractional (jobs.running 0.35). No loadAverage and no
 * oldestSampleAgeSeconds. `partial` is present ONLY on the live current hour, so test
 * `bucket.partial === true`, never `=== false`.
 */
export interface NodeMetricsHourly {
  cpu: { coresAllocated: number; hostCores: number; throttledCount: number; usagePercent: number };
  disk: { usedBytes: number };
  env: NodeMetricsEnvResource[];
  gpu: NodeMetricsGpu[];
  /** Floored UTC hour, epoch ms. */
  hourStart: number;
  jobs: { queued: number; queuedFree: number; running: number; runningFree: number };
  memory: { hostFreeBytes: number; hostTotalBytes: number; limitBytes: number; usedBytes: number };
  meta: { sampledContainers: number };
  partial?: boolean;
  /** Minute samples averaged into this bucket; 60 for a fully sampled hour. */
  sampleCount: number;
}

export interface NodeMetricsHistoryResult {
  buckets: NodeMetricsHourly[];
  count: number;
  /**
   * The CLAMPED range the node actually served (start floored to its retention horizon, stop capped
   * at now) — drive the chart axis off these, not off what was requested.
   */
  startTime: number;
  stopTime: number;
}

/** Narrow-or-null, never throw — same discipline as `getRuntimeMetrics`. A node on a build we don't
 * know about degrades to "no data" rather than crashing the page. */
export function asNodeMetricsSnapshot(value: unknown): NodeMetricsSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const v = value as Record<string, any>;
  if (typeof v.collectedAt !== 'number') {
    return null;
  }
  if (!v.cpu || typeof v.cpu.usagePercent !== 'number' || typeof v.cpu.hostCores !== 'number') {
    return null;
  }
  if (!v.memory || typeof v.memory.hostTotalBytes !== 'number') {
    return null;
  }
  if (!v.jobs || !v.disk || !v.network || !v.meta) {
    return null;
  }
  // gpu/env/loadAverage are always arrays node-side, but a malformed peer must not make a `.map`
  // downstream throw — the panel iterates all three without re-checking.
  return {
    ...v,
    cpu: { ...v.cpu, loadAverage: Array.isArray(v.cpu.loadAverage) ? v.cpu.loadAverage : [] },
    env: Array.isArray(v.env) ? v.env : [],
    gpu: Array.isArray(v.gpu) ? v.gpu : [],
  } as NodeMetricsSnapshot;
}

export function asNodeMetricsHistory(value: unknown): NodeMetricsHistoryResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const v = value as Record<string, any>;
  if (typeof v.startTime !== 'number' || typeof v.stopTime !== 'number' || !Array.isArray(v.buckets)) {
    return null;
  }
  const buckets = v.buckets
    .filter(
      (bucket: any) => bucket && typeof bucket.hourStart === 'number' && bucket.cpu && bucket.memory && bucket.jobs
    )
    .map((bucket: any) => ({ ...bucket, gpu: Array.isArray(bucket.gpu) ? bucket.gpu : [] })) as NodeMetricsHourly[];
  // `count` is recomputed rather than echoed: it must match the buckets that survived the filter.
  return { buckets, count: buckets.length, startTime: v.startTime, stopTime: v.stopTime };
}

/**
 * Fraction of the MACHINE the sampled containers are using. `usagePercent` is docker-stats semantics
 * summed over containers (100 == one busy core, 0..hostCores*100), so percent-of-host is
 * `usagePercent / (hostCores * 100) * 100`, i.e. `usagePercent / hostCores`. Deliberately NOT clamped
 * at 100 here — over-100 means the two denominators disagree (the node reads hostCores from
 * os.cpus() while the engine measures against docker's NCPU), which is worth seeing rather than hiding.
 */
export function cpuPercentOfHost(cpu: { hostCores: number; usagePercent: number }): number | undefined {
  if (!cpu.hostCores) {
    return undefined;
  }
  return cpu.usagePercent / cpu.hostCores;
}

/** Host RAM in use. os.totalmem()/os.freemem() are read on the node host, so inside a memory-limited
 * container they report the whole machine rather than the cgroup limit. */
export function hostMemoryPercent(memory: { hostFreeBytes: number; hostTotalBytes: number }): number | undefined {
  if (!memory.hostTotalBytes) {
    return undefined;
  }
  return ((memory.hostTotalBytes - memory.hostFreeBytes) / memory.hostTotalBytes) * 100;
}

/** Client-side rollup of one node snapshot for the ring buffer — the sibling of `UsageSample`. */
export interface NodeUsageSample {
  collectedAt: number;
  cpuPercentOfHost: number;
  /**
   * Workload disk as a percentage of what the node's environments advertise. `undefined` when they
   * advertise no disk at all — the sparkline then has nothing to plot, which is the honest outcome,
   * whereas a 0 would draw a floor that reads as "no disk in use".
   */
  diskPercentOfAdvertised?: number;
  gpuMemoryPercent: Record<string, number>;
  gpuUtilizationPercent: Record<string, number>;
  memoryPercentOfHost: number;
}

/**
 * Disk capacity advertised across the node's compute environments, in bytes. Env resources are GB per
 * /computeEnvironments while `disk.usedBytes` is bytes, so the conversion belongs here rather than at
 * each call site, where mixing the two silently is a 10^9 error.
 *
 * Not host disk: environments sharing a filesystem each advertise their own total, so this sum can
 * exceed the physical volume. Every label built on it says "advertised", never "capacity".
 */
export function advertisedDiskBytes(env: { resource: string; total: number }[]): number {
  return (env ?? [])
    .filter((row) => row.resource === 'disk')
    .reduce((total, row) => total + (Number.isFinite(row.total) ? row.total : 0) * 1_000_000_000, 0);
}

export function nodeSampleFromSnapshot(snapshot: NodeMetricsSnapshot): NodeUsageSample {
  const gpuMemoryPercent: Record<string, number> = {};
  const gpuUtilizationPercent: Record<string, number> = {};
  (snapshot.gpu ?? []).forEach((device) => {
    if (typeof device.utilizationPercent === 'number') {
      gpuUtilizationPercent[device.resourceId] = device.utilizationPercent;
    }
    if (
      typeof device.memoryUsedBytes === 'number' &&
      typeof device.memoryTotalBytes === 'number' &&
      device.memoryTotalBytes > 0
    ) {
      gpuMemoryPercent[device.resourceId] = (device.memoryUsedBytes / device.memoryTotalBytes) * 100;
    }
  });
  const diskTotalBytes = advertisedDiskBytes(snapshot.env);
  return {
    collectedAt: snapshot.collectedAt,
    cpuPercentOfHost: cpuPercentOfHost(snapshot.cpu) ?? 0,
    diskPercentOfAdvertised:
      diskTotalBytes > 0 ? (snapshot.disk.usedBytes / diskTotalBytes) * 100 : undefined,
    gpuMemoryPercent,
    gpuUtilizationPercent,
    memoryPercentOfHost: hostMemoryPercent(snapshot.memory) ?? 0,
  };
}
