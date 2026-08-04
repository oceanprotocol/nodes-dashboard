import { ServiceStatusNumber } from '@oceanprotocol/lib';

// The node reports one of ~14 numeric statuses. For display we collapse them into three visual
// kinds — a live service (green dot), one still settling (spinner), or a terminal/failed one
// (dim/red dot) — plus a human label that reads better than the node's raw `statusText`.
export type ServiceStatusKind = 'running' | 'pending' | 'dead' | 'failed';

// ocean-node reports `Restarting = 45` (set by SERVICE_RESTART: teardown + re-pull + new container)
// but the installed @oceanprotocol/lib enum doesn't declare it yet — reference it by literal so an
// Edit relaunch shows "Restarting" instead of the raw "Status 45", and is treated as pending (not
// terminal, not failed). Remove once the lib enum gains the member.
const RESTARTING_STATUS = 45 as ServiceStatusNumber;

export interface ServiceStatusView {
  kind: ServiceStatusKind;
  label: string;
}

// Restarting (SERVICE_RESTART accepted; teardown + re-pull/build + new container in progress). The
// installed @oceanprotocol/lib enum predates this status (ocean-node ServiceOnDemand.ts adds it at
// 45), so it isn't on ServiceStatusNumber — reference the raw code until the lib enum catches up.
const SERVICE_STATUS_RESTARTING = 45;

// Terminal failure states — rendered as an error, not just "dead/dim".
const FAILED_STATUSES = new Set<ServiceStatusNumber>([
  ServiceStatusNumber.PullImageFailed,
  ServiceStatusNumber.BuildImageFailed,
  ServiceStatusNumber.VulnerableImage,
  ServiceStatusNumber.Error,
]);

// Terminal non-failure states — the service ran its course.
const DONE_STATUSES = new Set<ServiceStatusNumber>([ServiceStatusNumber.Stopped, ServiceStatusNumber.Expired]);

// Friendlier labels than the node's raw statusText (e.g. "PullImage" → "Pulling image").
const LABELS: Record<ServiceStatusNumber, string> = {
  [ServiceStatusNumber.Starting]: 'Starting',
  [ServiceStatusNumber.PullImage]: 'Pulling image',
  [ServiceStatusNumber.PullImageFailed]: 'Image pull failed',
  [ServiceStatusNumber.BuildImage]: 'Building image',
  [ServiceStatusNumber.BuildImageFailed]: 'Build failed',
  [ServiceStatusNumber.VulnerableImage]: 'Vulnerable image',
  [ServiceStatusNumber.Locking]: 'Locking funds',
  [ServiceStatusNumber.Claiming]: 'Processing payment',
  [ServiceStatusNumber.Running]: 'Running',
  [RESTARTING_STATUS]: 'Restarting',
  [ServiceStatusNumber.Stopping]: 'Stopping',
  [ServiceStatusNumber.Stopped]: 'Stopped',
  [ServiceStatusNumber.Expired]: 'Expired',
  [ServiceStatusNumber.Error]: 'Error',
};

/** Map a service status to its display kind + label. Falls back to the node's raw text if unknown. */
export function getServiceStatusView(status: ServiceStatusNumber | undefined, statusText?: string): ServiceStatusView {
  if (status === undefined) {
    return { kind: 'pending', label: statusText || 'Unknown' };
  }
  // Restarting isn't in the installed lib enum; treat it as a live state (green) with its own label.
  // Cast: the node can emit 45 at runtime even though the typed enum doesn't include it yet.
  if ((status as number) === SERVICE_STATUS_RESTARTING) {
    return { kind: 'running', label: 'Restarting' };
  }
  const label = LABELS[status] ?? statusText ?? `Status ${status}`;
  if (status === ServiceStatusNumber.Running) {
    return { kind: 'running', label };
  }
  if (FAILED_STATUSES.has(status)) {
    return { kind: 'failed', label };
  }
  if (DONE_STATUSES.has(status)) {
    return { kind: 'dead', label };
  }
  return { kind: 'pending', label };
}

// A workload is "in flight" (still running or on its way there) when its view kind is running or
// pending — i.e. not a terminal failure or a settled/done state. Deriving it from the view keeps a
// single source of truth for the status codes: the mappers above / below.
const IN_FLIGHT_KINDS = new Set<ServiceStatusKind>(['running', 'pending']);

/** True while a service is mid-lifecycle (starting/pulling/locking/claiming/restarting/running/…). */
export function isServiceInFlight(status: ServiceStatusNumber | undefined, statusText?: string): boolean {
  return IN_FLIGHT_KINDS.has(getServiceStatusView(status, statusText).kind);
}

/**
 * Statuses under which the node REFUSES a SERVICE_RESTART (which is also how an Edit relaunches:
 * serviceRestart + a new dockerCmd). Mirrors ocean-node:
 *
 * - `Expired` — `restartService` throws "Cannot restart an expired service". (The page pairs this
 *   with its own `expiresAt` check: the expiry cron flips the status asynchronously, so a service can
 *   be past its paid window while still reading Running.)
 * - Everything else here holds the per-service lifecycle lock, so `acquireServiceLifecycleLock`
 *   rejects with "Service <id> has a start/stop/restart operation in progress — retry shortly". The
 *   lock covers the whole start pipeline (`SERVICE_START_PENDING_STATUSES` =
 *   Starting/Locking/PullImage/BuildImage/Claiming/Restarting) and a teardown (Stopping), and every
 *   one of those statuses is persisted while it's held.
 *
 * Restart is therefore offered on Running and on the terminal failure/stopped statuses — a crashed or
 * stopped service keeps its slot (and its host ports) until `expiresAt`, so relaunching it is valid.
 */
const RESTART_BLOCKED_STATUSES = new Set<ServiceStatusNumber>([
  ServiceStatusNumber.Expired,
  ServiceStatusNumber.Starting,
  ServiceStatusNumber.Locking,
  ServiceStatusNumber.PullImage,
  ServiceStatusNumber.BuildImage,
  ServiceStatusNumber.Claiming,
  RESTARTING_STATUS,
  ServiceStatusNumber.Stopping,
]);

/**
 * Statuses under which the node REFUSES a SERVICE_EXTEND (Prolong). Extend is being widened on the
 * node to accept everything except:
 *
 * - `Expired` — the paid window is over; a new service is the only way forward.
 * - `Locking` / `Claiming` — the initial payment is mid-flight (escrow createLock / claimLock).
 *   Extending now would race a second escrow operation against the first on the same service.
 *
 * Unlike restart, the busy/mid-start statuses are NOT blocked: extend only rewrites `expiresAt` and
 * the payment record, so it's valid while a container is still coming up. It does run inside
 * `runExclusive` (same lifecycle lock), so a call landing mid-start/restart can still come back with
 * "operation in progress" — that's a transient retry, not a permanent no, so the button stays live.
 */
const PROLONG_BLOCKED_STATUSES = new Set<ServiceStatusNumber>([
  ServiceStatusNumber.Expired,
  ServiceStatusNumber.Locking,
  ServiceStatusNumber.Claiming,
]);

/** True when the node would refuse a restart (or an Edit relaunch) at this status. */
export function isRestartBlocked(status: ServiceStatusNumber | undefined): boolean {
  return status === undefined || RESTART_BLOCKED_STATUSES.has(status);
}

/** True when the node would refuse a Prolong (SERVICE_EXTEND) at this status. */
export function isProlongBlocked(status: ServiceStatusNumber | undefined): boolean {
  return status === undefined || PROLONG_BLOCKED_STATUSES.has(status);
}

// ── Compute-job status (ocean-node src/@types/C2D/C2D.ts: C2DStatusNumber / C2DStatusText) ──
// The lib doesn't export the C2D enum, so map the raw codes here. Same three visual kinds as
// services: running (algorithm executing), pending (queued/provisioning/publishing …), failed, dead.
const JOB_STATUS_LABELS: Record<number, string> = {
  0: 'Started',
  1: 'Queued',
  2: 'Expired in queue',
  10: 'Pulling image',
  11: 'Image pull failed',
  12: 'Building image',
  13: 'Build failed',
  14: 'Vulnerable image',
  20: 'Configuring volumes',
  21: 'Volume creation failed',
  22: 'Container creation failed',
  30: 'Provisioning',
  31: 'Data provisioning failed',
  32: 'Algorithm provisioning failed',
  33: 'Data upload failed',
  40: 'Running',
  41: 'Algorithm failed',
  42: 'Disk quota exceeded',
  50: 'Filtering results',
  60: 'Publishing results',
  61: 'Results fetch failed',
  62: 'Results upload failed',
  70: 'Finished',
  71: 'Settling',
};

const JOB_FAILED_STATUSES = new Set([2, 11, 13, 14, 21, 22, 31, 32, 33, 41, 42, 61, 62]);
const JOB_RUNNING_STATUS = 40; // RunningAlgorithm
const JOB_FINISHED_STATUS = 70; // JobFinished (71 JobSettle also >= this)

/** Map a compute job's status to the shared display kind + label (mirrors getServiceStatusView). */
export function getComputeJobStatusView(status: number | undefined, statusText?: string): ServiceStatusView {
  if (status === undefined) {
    return { kind: 'pending', label: statusText || 'Unknown' };
  }
  const label = JOB_STATUS_LABELS[status] ?? statusText ?? `Status ${status}`;
  if (status === JOB_RUNNING_STATUS) {
    return { kind: 'running', label };
  }
  if (JOB_FAILED_STATUSES.has(status)) {
    return { kind: 'failed', label };
  }
  if (status >= JOB_FINISHED_STATUS) {
    return { kind: 'dead', label };
  }
  return { kind: 'pending', label };
}

/** True while a compute job is mid-lifecycle (queued/provisioning/running/publishing/…). */
export function isComputeJobInFlight(status: number | undefined, statusText?: string): boolean {
  return IN_FLIGHT_KINDS.has(getComputeJobStatusView(status, statusText).kind);
}
