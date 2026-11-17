import { ComputeEnvironment } from '@/types/environments';
import { ServiceJob } from '@oceanprotocol/lib';

/** Shown in place of a download once the node has dropped a service's logs. */
export const SERVICE_LOGS_RETENTION_ENDED_NOTE = 'Logs are no longer available on the node (retention period ended).';

/**
 * When the node stops keeping what a service left behind, in Unix ms: the service's `expiresAt` plus
 * the environment's `storageExpiry` (seconds). This is the window ocean-node applies to a service's
 * stored results.
 *
 * Undefined while either side is unknown (job not polled yet, or an environment that advertises no
 * `storageExpiry`). Callers must read that as "can't tell", never as "expired".
 */
export function serviceLogsRetentionEndsAt(
  job: Pick<ServiceJob, 'expiresAt'> | null | undefined,
  environment: Pick<ComputeEnvironment, 'storageExpiry'> | null | undefined
): number | undefined {
  const expiresAt = job?.expiresAt;
  const storageExpiry = environment?.storageExpiry;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    return undefined;
  }
  if (typeof storageExpiry !== 'number' || !Number.isFinite(storageExpiry) || storageExpiry < 0) {
    return undefined;
  }
  return expiresAt + storageExpiry * 1000;
}

/** True once the retention window has passed. An unknown window is never treated as ended. */
export function isServiceLogsRetentionEnded(retentionEndsAt: number | undefined, now: number = Date.now()): boolean {
  return retentionEndsAt !== undefined && now >= retentionEndsAt;
}

/**
 * File name for a downloaded service log: `service-<id>-logs.txt` for a finished service, or
 * `service-<id>-logs-<UTC timestamp>.txt` for a snapshot of one that is still running, so
 * successive snapshots don't overwrite each other.
 */
export function serviceLogsFilename(serviceId: string, isSnapshot: boolean, now: Date = new Date()): string {
  if (!isSnapshot) {
    return `service-${serviceId}-logs.txt`;
  }
  // 2026-11-17T14-03-22Z: ISO-8601 to the second, without the colons file systems reject.
  const timestamp = `${now.toISOString().slice(0, 19).replace(/:/g, '-')}Z`;
  return `service-${serviceId}-logs-${timestamp}.txt`;
}
