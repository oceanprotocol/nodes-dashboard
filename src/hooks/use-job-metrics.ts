import { useNodeTokensContext } from '@/context/node-tokens';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { buildNodeJobId } from '@/lib/build-node-job-id';
import { getComputeJobStatusView } from '@/services/service-status';
import { ComputeJob } from '@/types/jobs';
import { ContainerMetricsSnapshot, getRuntimeMetrics } from '@/types/runtime-metrics';
import { useEffect, useState } from 'react';

// COMPUTE_GET_STATUS attaches runtimeMetrics best-effort (only when the caller carries owner
// credentials — consumerAddress + Authorization, which computeStatus() already sends). Poll slowly:
// JobLogsPanel already spends ~6 req/min against ocean-node's ~30/min-per-requester budget when the
// modal is open, so this stays well under it (1 req / 15s = 4/min) rather than compounding.
const POLL_INTERVAL_MS = 15_000;
const RATE_LIMIT_BACKOFF_MS = 15_000;

// Same rate-limit shape ocean-node returns everywhere (see use-job-logs.ts's isRateLimitError).
function isRateLimitError(e: any): boolean {
  const msg = typeof e?.message === 'string' ? e.message : '';
  return e?.status === 403 || e?.httpStatus === 403 || /rate limit exceeded|too many/i.test(msg);
}

function rateLimitBackoffMs(e: any, fallback: number): number {
  const m = /in\s+(\d+)\s*second/i.exec(typeof e?.message === 'string' ? e.message : '');
  return m ? Math.min(60_000, (parseInt(m[1], 10) + 1) * 1000) : fallback;
}

/**
 * Polls a compute job's runtime metrics while the job info modal is open. Reuses the node token
 * `JobLogsPanel` already mints for the same job/modal (no extra wallet signature), and stops once
 * the job reaches a terminal status — a FINISHED/failed job still carries its LAST snapshot on the
 * job record, so one final read is enough; nothing to poll for after that.
 *
 * Absence of metrics (collection disabled node-side, or a transient fetch error) is the normal case,
 * never an error state — this hook has no error output on purpose. `JobLogsPanel`/`DownloadLogsButton`
 * already own surfacing real auth/connectivity failures for this same job.
 */
export function useJobMetrics(
  job: ComputeJob | null,
  open: boolean,
  nodeUri: NodeUri | null
): ContainerMetricsSnapshot | null {
  const { isReady, getComputeJobStatus } = useP2P();
  const { getNodeToken, clearNodeToken } = useNodeTokensContext();
  const [metrics, setMetrics] = useState<ContainerMetricsSnapshot | null>(null);
  const nodeUriKey = Array.isArray(nodeUri) ? nodeUri.join('|') : (nodeUri ?? '');

  useEffect(() => {
    if (!open || !job || !isReady || !nodeUri) {
      return;
    }
    let cancelled = false;
    setMetrics(null);

    const jobId = buildNodeJobId(job);
    const nodeId = job.peerId;
    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const run = async () => {
      let token: string;
      try {
        token = await getNodeToken(nodeId, nodeUri);
      } catch {
        return; // no cached token yet and minting failed — stay silent, this isn't the panel that owns auth errors
      }

      // Refresh once on a 401, same pattern as useJobLogs — the shared token can expire mid-poll.
      const reauthed = async (e: any): Promise<boolean> => {
        const msg = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
        const authFailed =
          e?.status === 401 || e?.httpStatus === 401 || /unauthori[sz]ed|token.*expired|invalid token/.test(msg);
        if (!authFailed) {
          return false;
        }
        clearNodeToken(nodeId);
        try {
          token = await getNodeToken(nodeId, nodeUri);
          return true;
        } catch {
          return false;
        }
      };

      while (!cancelled) {
        try {
          const result: any = await getComputeJobStatus(nodeUri, jobId, token);
          const entry = Array.isArray(result) ? result[0] : result;
          if (!cancelled) {
            setMetrics(getRuntimeMetrics(entry));
          }
          const { kind } = getComputeJobStatusView(entry?.status, entry?.statusText);
          if (kind !== 'running' && kind !== 'pending') {
            return; // terminal — the snapshot just set is the job's last one; nothing left to poll
          }
        } catch (e: any) {
          if (cancelled) {
            return;
          }
          if (await reauthed(e)) {
            continue;
          }
          if (isRateLimitError(e)) {
            await delay(rateLimitBackoffMs(e, RATE_LIMIT_BACKOFF_MS));
            continue;
          }
          // Any other transient error: absence of metrics is normal, so retry on the slow cadence
          // rather than surfacing anything — see the doc comment above.
        }
        if (cancelled) {
          return;
        }
        await delay(POLL_INTERVAL_MS);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // Keyed on job identity only, same rationale as useJobLogs — must not restart on indexed-row
    // status churn (that would drop the poll's own view of terminal state mid-flight).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isReady, job?.peerId, job?.jobId, job?.environment, job?.environmentId, nodeUriKey]);

  return metrics;
}
