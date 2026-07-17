import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { cleanLogText } from '@/lib/strip-ansi';
import { demuxDockerLogs, getServiceLogs } from '@/services/nodeService';
import { ServiceJob, ServiceStatusNumber } from '@oceanprotocol/lib';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ServiceLogViewStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'ended' | 'error';

const MAX_LINES = 5000;
// A "failure" is a connection that ended/threw without producing any data. Bail after this many in
// a row so an unreachable node doesn't spin the reconnect loop forever.
const MAX_CONSECUTIVE_FAILURES = 5;
const RECONNECT_DELAY_MS = 1500;

// Statuses past which live-tailing is pointless — the container reached a terminal state, so grab
// the final logs once and stop. Mirrors manage-service-page's TERMINAL_STATUSES minus Running
// (Running IS the live-tail state here).
const TERMINAL_STATUSES = new Set<ServiceStatusNumber>([
  ServiceStatusNumber.PullImageFailed,
  ServiceStatusNumber.BuildImageFailed,
  ServiceStatusNumber.VulnerableImage,
  ServiceStatusNumber.Stopped,
  ServiceStatusNumber.Expired,
  ServiceStatusNumber.Error,
]);

interface UseServiceLogsParams {
  serviceId: string;
  nodeUri: NodeUri | null;
  consumerAddress?: string;
  // Resolve a node auth token (from the shared node-auth cache — same token the status poll uses,
  // so opening the log panel doesn't mint a second token and clash on the node's per-address nonce).
  getToken: () => Promise<string>;
  // Drop the cached token so the next getToken() re-mints — called when the node rejects it (auth error).
  clearToken: () => void;
  open: boolean;
}

interface UseServiceLogsResult {
  lines: string[];
  status: ServiceLogViewStatus;
  error: string | null;
  stop: () => void;
}

/**
 * Live-tails a running inference service's container logs, with status-checked reconnect, and shows
 * the final logs once the service reaches a terminal state. Mirrors use-job-logs but for the
 * ServiceJob flow (auth via createAuthToken, status via getServiceStatus, byte stream via
 * streamServiceLogs). The Docker stream replays the FULL history on each connection, so each
 * connection's accumulated buffer IS the complete log — re-demux the whole buffer on every chunk
 * rather than appending across reconnects (avoids duplicated lines and mid-chunk header splits).
 */
export function useServiceLogs({
  serviceId,
  nodeUri,
  consumerAddress,
  getToken,
  clearToken,
  open,
}: UseServiceLogsParams): UseServiceLogsResult {
  const { isReady, getServiceStatus, streamServiceLogs } = useP2P();

  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<ServiceLogViewStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const nodeUriKey = Array.isArray(nodeUri) ? nodeUri.join('|') : (nodeUri ? 'node' : '');

  const stop = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setStatus((prev) => (prev === 'ended' || prev === 'error' ? prev : 'ended'));
  }, []);

  useEffect(() => {
    if (!open || !isReady || !nodeUri || !consumerAddress || !serviceId) {
      return;
    }

    cancelledRef.current = false;
    setLines([]);
    setError(null);
    setStatus('connecting');

    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    // Demux the full accumulated byte buffer to text lines (capped at MAX_LINES).
    const toLines = (bytes: Uint8Array): string[] => {
      const cleaned = cleanLogText(demuxDockerLogs(bytes));
      const all = cleaned.split('\n');
      return all.length > MAX_LINES ? all.slice(all.length - MAX_LINES) : all;
    };

    const isAuthError = (e: unknown): boolean => {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      const status = (e as any)?.status ?? (e as any)?.httpStatus;
      return status === 401 || /unauthori[sz]ed|token.*expired|invalid token|nonce/.test(msg);
    };

    const run = async () => {
      let token: string;
      try {
        token = await getToken();
      } catch (e) {
        if (!cancelledRef.current) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Failed to authenticate with node');
        }
        return;
      }

      let failures = 0;

      while (!cancelledRef.current) {
        let job: ServiceJob | null = null;
        try {
          const jobs = await getServiceStatus(nodeUri, token, serviceId);
          job = jobs.find((j) => j.serviceId === serviceId) ?? jobs[0] ?? null;
          failures = 0;
        } catch (e) {
          if (cancelledRef.current) {
            return;
          }
          // Node rejected the (cached) token — drop it and re-mint on the next attempt.
          if (isAuthError(e)) {
            clearToken();
            try {
              token = await getToken();
            } catch (authErr) {
              if (!cancelledRef.current) {
                setStatus('error');
                setError(authErr instanceof Error ? authErr.message : 'Failed to authenticate with node');
              }
              return;
            }
          }
          failures += 1;
          if (failures >= MAX_CONSECUTIVE_FAILURES) {
            if (!cancelledRef.current) {
              setStatus('error');
              setError('Lost connection to the node.');
            }
            return;
          }
          if (!cancelledRef.current) {
            setStatus('reconnecting');
          }
          await delay(RECONNECT_DELAY_MS);
          continue;
        }

        const terminal = !!job && TERMINAL_STATUSES.has(job.status);

        if (terminal) {
          // No live container to tail — grab the stored/final output once and stop.
          try {
            const text = await getServiceLogs(nodeUri, token, serviceId);
            if (!cancelledRef.current) {
              const cleaned = cleanLogText(text);
              setLines(cleaned ? cleaned.split('\n') : ['No logs available for this service.']);
              setStatus('ended');
            }
          } catch (e) {
            if (!cancelledRef.current) {
              setStatus('error');
              setError(e instanceof Error ? e.message : 'Failed to load logs');
            }
          }
          return;
        }

        // Container is up (Running or still spinning up) → live-tail until the stream ends, then
        // re-check status on the next loop.
        try {
          const controller = new AbortController();
          abortRef.current = controller;
          const buffer: Uint8Array[] = [];
          let started = false;
          for await (const chunk of streamServiceLogs(nodeUri, token, serviceId, controller.signal)) {
            if (cancelledRef.current) {
              return;
            }
            if (!started) {
              started = true;
              setStatus('live');
            }
            buffer.push(chunk);
            const total = buffer.reduce((sum, p) => sum + p.length, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const p of buffer) {
              merged.set(p, offset);
              offset += p.length;
            }
            setLines(toLines(merged));
          }
          if (!started && !cancelledRef.current) {
            // Stream produced nothing (node has no live output yet) — show a waiting state.
            setStatus('live');
          }
        } catch (e) {
          if (cancelledRef.current) {
            return;
          }
          // ocean.js puts a fixed timeout on the streaming fetch, so a quiet follow-stream (container
          // running, no new output) throws TimeoutError. That's expected — swallow it and reconnect.
          // Anything else is a real transient error worth logging.
          const timedOut = e instanceof Error && e.name === 'TimeoutError';
          if (!timedOut) {
            console.error('Service log stream error:', e);
          }
        }

        if (cancelledRef.current) {
          return;
        }
        await delay(RECONNECT_DELAY_MS);
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
    // getToken/clearToken come from the node-auth context (stable useCallback refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isReady, serviceId, nodeUriKey, consumerAddress]);

  return { lines, status, error, stop };
}
