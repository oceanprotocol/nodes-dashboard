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

// Terminal failure states — rendered as an error, not just "dead/dim".
const FAILED_STATUSES = new Set<ServiceStatusNumber>([
  ServiceStatusNumber.PullImageFailed,
  ServiceStatusNumber.BuildImageFailed,
  ServiceStatusNumber.VulnerableImage,
  ServiceStatusNumber.Error,
]);

// Terminal non-failure states — the service ran its course.
const DONE_STATUSES = new Set<ServiceStatusNumber>([
  ServiceStatusNumber.Stopped,
  ServiceStatusNumber.Expired,
]);

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
export function getServiceStatusView(
  status: ServiceStatusNumber | undefined,
  statusText?: string
): ServiceStatusView {
  if (status === undefined) {
    return { kind: 'pending', label: statusText || 'Unknown' };
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
