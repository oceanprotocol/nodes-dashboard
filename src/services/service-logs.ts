import { ComputeEnvironment } from '@/types/environments';
import { ServiceJob } from '@oceanprotocol/lib';

/** Shared by the panel note and the click-time toast, so both explain the disabled download the same way. */
export const SERVICE_LOGS_RETENTION_ENDED_NOTE = 'Logs are no longer available on the node (retention period ended).';

/**
 * Mirrors the window after which ocean-node deletes a service's stored results and saved logs
 * (`expiresAt` + the environment's `storageExpiry`), so the page can say so before the user clicks.
 * Unix ms.
 *
 * Undefined while either side is unknown (job not polled yet, or an environment that advertises no
 * `storageExpiry`). Callers must read that as "can't tell", never as "expired": a missing field must
 * not lock the user out of logs the node still has.
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

/**
 * An unknown window counts as open: a download that turns out empty costs a toast, while one blocked
 * by mistake hides logs the node still has.
 */
export function isServiceLogsRetentionEnded(retentionEndsAt: number | undefined, now: number = Date.now()): boolean {
  return retentionEndsAt !== undefined && now >= retentionEndsAt;
}

/**
 * A snapshot's name carries the time it was taken, so successive snapshots of a running service can
 * be told apart and sort in order. A finished service's log won't change, so it gets a plain name.
 */
export function serviceLogsFilename(serviceId: string, isSnapshot: boolean, now: Date = new Date()): string {
  if (!isSnapshot) {
    return `service-${serviceId}-logs.txt`;
  }
  // 2026-11-17T14-03-22Z: ISO-8601 with dashes for colons, because some file systems reject colons.
  const timestamp = `${now.toISOString().slice(0, 19).replace(/:/g, '-')}Z`;
  return `service-${serviceId}-logs-${timestamp}.txt`;
}
