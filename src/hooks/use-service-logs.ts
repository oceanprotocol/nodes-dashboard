import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { cleanLogText } from '@/lib/strip-ansi';
import { withTimeout } from '@/lib/with-timeout';
import { demuxDockerLogs, getServiceLogs } from '@/services/nodeService';
import { ServiceJob, ServiceStatusNumber } from '@oceanprotocol/lib';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ServiceLogViewStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'ended' | 'error';

const MAX_LINES = 5000;
// A "failure" is a connection that ended/threw without producing any data. Bail after this many in
// a row so an unreachable node doesn't spin the reconnect loop forever.
const MAX_CONSECUTIVE_FAILURES = 5;
const RECONNECT_DELAY_MS = 1500;
// A P2P status round-trip has no built-in timeout: if the node/relay goes unreachable between
// reconnects, an un-capped dial parks the tail loop forever (stuck on "reconnecting", leaks past
// unmount). Cap it so a hung dial surfaces as a failure and the loop retries/bails like any other.
const STATUS_TIMEOUT_MS = 30000;

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
  /** Re-open the stream after stop() / an error / a terminal fetch. Re-tails from scratch. */
  resume: () => void;
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
  // Bumped by resume() to re-run the stream effect after it settled (stopped / errored / terminal).
  const [runEpoch, setRunEpoch] = useState(0);

  // Generation counter rather than a boolean cancel flag: stop() and every effect re-run bump it, so
  // a loop from an earlier run can still tell it was superseded after a resume. A shared boolean
  // flipped back to false would let the stopped loop carry on next to the new one.
  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  // Faithful identity of nodeUri for the effect deps. A bare-string nodeUri (toNodeUri's fallback
  // when a node advertises no dialable ws/wss addrs) must key on its actual value — collapsing every
  // string to a constant would hide a node change and keep the stream tailing the previous node.
  const nodeUriKey = Array.isArray(nodeUri) ? nodeUri.join('|') : nodeUri ? String(nodeUri) : '';

  const stop = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    setStatus((prev) => (prev === 'ended' || prev === 'error' ? prev : 'ended'));
  }, []);

  const resume = useCallback(() => {
    setRunEpoch((epoch) => epoch + 1);
  }, []);

  useEffect(() => {
    if (!open || !isReady || !nodeUri || !consumerAddress || !serviceId) {
      return;
    }

    runIdRef.current += 1;
    const runId = runIdRef.current;
    /** True once stop(), a resume, or unmount superseded this run. */
    const cancelled = () => runIdRef.current !== runId;

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
        if (!cancelled()) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Failed to authenticate with node');
        }
        return;
      }

      let failures = 0;

      while (!cancelled()) {
        let job: ServiceJob | null = null;
        try {
          const jobs = await withTimeout(
            (signal) => getServiceStatus(nodeUri, token, serviceId, signal),
            STATUS_TIMEOUT_MS,
            'Service status'
          );
          job = jobs.find((j) => j.serviceId === serviceId) ?? jobs[0] ?? null;
          failures = 0;
        } catch (e) {
          if (cancelled()) {
            return;
          }
          // Node rejected the (cached) token — drop it and re-mint on the next attempt.
          if (isAuthError(e)) {
            clearToken();
            try {
              token = await getToken();
            } catch (authErr) {
              if (!cancelled()) {
                setStatus('error');
                setError(authErr instanceof Error ? authErr.message : 'Failed to authenticate with node');
              }
              return;
            }
          }
          failures += 1;
          if (failures >= MAX_CONSECUTIVE_FAILURES) {
            if (!cancelled()) {
              setStatus('error');
              setError('Lost connection to the node.');
            }
            return;
          }
          if (!cancelled()) {
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
            if (!cancelled()) {
              const cleaned = cleanLogText(text);
              setLines(cleaned ? cleaned.split('\n') : ['No logs available for this service.']);
              setStatus('ended');
            }
          } catch (e) {
            if (!cancelled()) {
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
            if (cancelled()) {
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
          if (!started && !cancelled()) {
            // Stream produced nothing (node has no live output yet) — show a waiting state.
            setStatus('live');
          }
        } catch (e) {
          if (cancelled()) {
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

        if (cancelled()) {
          return;
        }
        await delay(RECONNECT_DELAY_MS);
      }
    };

    run();

    return () => {
      runIdRef.current += 1;
      abortRef.current?.abort();
    };
    // getToken/clearToken come from the node-auth context (stable useCallback refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isReady, serviceId, nodeUriKey, consumerAddress, runEpoch]);

  return { lines, status, error, stop, resume };
}
