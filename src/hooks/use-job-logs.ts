import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { useNodeAuth } from '@/contexts/node-auth-context';
import { buildNodeJobId } from '@/lib/build-node-job-id';
import { cleanLogText } from '@/lib/strip-ansi';
import { ComputeJob } from '@/types/jobs';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LogViewStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'loading-result' | 'ended' | 'error';

const MAX_LINES = 5000;

// Reopen cadence for following ongoing logs. Two P2P requests per cycle (status + stream),
// so ~12 req/min — comfortably under ocean-node's default 30 req/min per-requester limit.
const REOPEN_INTERVAL_MS = 10_000;
// If the node still rate-limits us, back off rather than treating it as a dead node.
const RATE_LIMIT_BACKOFF_MS = 20_000;

// Compute status codes from ocean-node (src/@types/C2D/C2D.ts): >=70 is finished/settled, and these
// are the terminal failure codes. 40 (RunningAlgorithm) is when the algorithm container exists and its
// stdout can be live-tailed; below that the job is pulling/building/provisioning and only the stored
// build log (image.log) exists yet.
const RUNNING_ALGORITHM = 40;
const TERMINAL_STATUS = 70;
const FAILED_STATUS_CODES = new Set([2, 11, 13, 14, 21, 22, 31, 32, 33, 41, 42, 61, 62]);

function isTerminalEntry(entry: any): boolean {
  if (!entry) return false;
  const s = entry.status;
  if (typeof s === 'number') {
    if (s >= TERMINAL_STATUS) return true;
    if (FAILED_STATUS_CODES.has(s)) return true;
  }
  // Fall back to wording for unknown numeric codes. NOTE: presence of `results` is deliberately NOT
  // treated as terminal — the node exposes image.log in results while the build is still running.
  const text = typeof entry.statusText === 'string' ? entry.statusText.toLowerCase() : '';
  return /finish|complet|fail|error|timeout|expired|exceeded|vulnerable|stopped|removed/.test(text);
}

// ocean-node returns HTTP 403 "Rate limit exceeded. Try again in N seconds." when a
// requester exceeds its per-minute budget. Treat this as transient, not a lost node.
function isRateLimitError(e: any): boolean {
  const msg = typeof e?.message === 'string' ? e.message : '';
  return e?.status === 403 || e?.httpStatus === 403 || /rate limit exceeded|too many/i.test(msg);
}

// Honor the node's suggested wait ("Try again in N seconds.") when present, capped.
function rateLimitBackoffMs(e: any, fallback: number): number {
  const m = /in\s+(\d+)\s*second/i.exec(typeof e?.message === 'string' ? e.message : '');
  return m ? Math.min(60_000, (parseInt(m[1], 10) + 1) * 1000) : fallback;
}

interface UseJobLogsResult {
  lines: string[];
  status: LogViewStatus;
  error: string | null;
  stop: () => void;
}

// Streams live logs for a running job and renders stored .log files for a
// completed/failed job. The node's streamable-logs endpoint returns the current
// log snapshot (full history) and then ends per connection, so we reopen on a SLOW
// cadence to follow ongoing output — while blocking on any stream the node happens
// to keep open (true live, zero reopens). The status + stream P2P commands reuse the
// cached node token (1 request each), so the cadence stays far under ocean-node's
// per-requester rate limit (default 30 req/min). The old 1.5s loop blew past that
// limit, surfacing as a spurious "Lost connection to the node."; a rate-limit
// rejection is now treated as a transient backoff, never fatal. See docs/adr/0004.
export function useJobLogs(job: ComputeJob | null, open: boolean, nodeUri: NodeUri): UseJobLogsResult {
  const { isReady, streamComputeLogs, streamComputeResult, getComputeJobStatus } = useP2P();
  const { getNodeToken, clearNodeToken } = useNodeAuth();

  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<LogViewStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const nodeUriKey = Array.isArray(nodeUri) ? nodeUri.join('|') : (nodeUri ?? '');

  const stop = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setStatus((prev) => (prev === 'ended' || prev === 'error' ? prev : 'ended'));
  }, []);

  useEffect(() => {
    if (!open || !job || !isReady) {
      return;
    }

    cancelledRef.current = false;
    setLines([]);
    setError(null);
    setStatus('connecting');

    const jobId = buildNodeJobId(job);
    // Auth tokens are cached per node by peerId; the P2P calls dial via `nodeUri` (multiaddrs).
    const nodeId = job.peerId;

    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const toLines = (fullText: string): string[] => {
      const cleaned = cleanLogText(fullText);
      const all = cleaned.split('\n');
      return all.length > MAX_LINES ? all.slice(all.length - MAX_LINES) : all;
    };

    const fetchStatusEntry = async (token: string): Promise<any> => {
      const result: any = await getComputeJobStatus(nodeUri, jobId, token);
      return Array.isArray(result) ? result[0] : result;
    };

    const fetchStoredLogsText = async (token: string, entry: any): Promise<string> => {
      const logFiles: any[] = (entry?.results ?? []).filter((r: any) => r?.filename?.includes('.log'));
      if (logFiles.length === 0) return '';
      const decoder = new TextDecoder('utf-8');
      let text = '';
      for (const file of logFiles) {
        if (cancelledRef.current) return text;
        text += `\n===== ${file.filename} =====\n`;
        const generator = await streamComputeResult(nodeUri, token, jobId, file.index);
        for await (const chunk of generator) {
          if (cancelledRef.current) return text;
          text += decoder.decode(chunk, { stream: true });
        }
        text += decoder.decode();
      }
      return text;
    };

    const loadFinalStoredLogs = async (token: string, entry: any): Promise<void> => {
      setStatus('loading-result');
      const text = await fetchStoredLogsText(token, entry);
      if (cancelledRef.current) return;
      setLines((prev) => (text ? toLines(text) : prev.length ? prev : ['No logs available for this job.']));
      setStatus('ended');
    };

    const run = async () => {
      let token: string;
      try {
        token = await getNodeToken(nodeId, nodeUri);
      } catch (e) {
        if (!cancelledRef.current) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Failed to authenticate with node');
        }
        return;
      }

      // Refresh the node token once on a 401. true → fresh token obtained (caller retries);
      // false → not an auth error (caller handles) or refresh failed (error state already set).
      const reauthed = async (e: any): Promise<boolean> => {
        const msg = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
        const authFailed =
          e?.status === 401 || e?.httpStatus === 401 || /unauthori[sz]ed|token.*expired|invalid token/.test(msg);
        if (!authFailed) return false;
        clearNodeToken(nodeId);
        try {
          token = await getNodeToken(nodeId, nodeUri);
          return true;
        } catch (refreshErr) {
          if (!cancelledRef.current) {
            setStatus('error');
            setError(refreshErr instanceof Error ? refreshErr.message : 'Failed to re-authenticate with node');
          }
          return false;
        }
      };

      // Live-tail the algorithm's stdout. Blocks while the node keeps the stream open
      // (true live); returns when the node ends the connection's snapshot, after which
      // the outer loop reopens on the slow cadence. Each connection replays the FULL
      // history, so the whole buffer is treated as the complete log (no cross-reopen
      // append) to avoid duplicated lines.
      const streamLiveOnce = async (): Promise<void> => {
        const controller = new AbortController();
        abortRef.current = controller;
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        const generator = await streamComputeLogs(nodeUri, token, jobId, controller.signal);
        if (cancelledRef.current) return;
        setStatus('live');
        for await (const chunk of generator) {
          if (cancelledRef.current) return;
          buffer += decoder.decode(chunk, { stream: true });
          setLines(toLines(buffer));
        }
        buffer += decoder.decode();
        if (buffer) setLines(toLines(buffer));
      };

      // Backoff helper: keep the view "reconnecting" and wait, without ever declaring the
      // node dead (rate-limit and transient errors are recoverable). Returns via caller loop.
      const backoff = async (ms: number) => {
        if (!cancelledRef.current) setStatus('reconnecting');
        await delay(ms);
      };

      // Follow the job: reopen on the slow cadence until it reaches a terminal status
      // (then load the stored result logs) or the panel closes.
      while (!cancelledRef.current) {
        let entry: any;
        try {
          entry = await fetchStatusEntry(token);
        } catch (e: any) {
          if (cancelledRef.current) return;
          if (await reauthed(e)) continue;
          if (isRateLimitError(e)) {
            await backoff(rateLimitBackoffMs(e, RATE_LIMIT_BACKOFF_MS));
            continue;
          }
          // Other transient error → retry on the slow cadence instead of giving up.
          await backoff(REOPEN_INTERVAL_MS);
          continue;
        }

        if (isTerminalEntry(entry)) {
          try {
            await loadFinalStoredLogs(token, entry);
          } catch (e: any) {
            if (!cancelledRef.current && (await reauthed(e))) {
              try {
                await loadFinalStoredLogs(token, await fetchStatusEntry(token));
                return;
              } catch {
                /* fall through to error */
              }
            }
            if (!cancelledRef.current) {
              setStatus('error');
              setError(e instanceof Error ? e.message : 'Failed to load logs');
            }
          }
          return;
        }

        const numeric = typeof entry?.status === 'number' ? entry.status : undefined;

        if (numeric !== undefined && numeric >= RUNNING_ALGORITHM) {
          // Algorithm container is up → live-tail stdout (blocks if the node follows live).
          try {
            await streamLiveOnce();
          } catch (e: any) {
            if (cancelledRef.current) return;
            if (await reauthed(e)) continue;
            if (isRateLimitError(e)) {
              await backoff(rateLimitBackoffMs(e, RATE_LIMIT_BACKOFF_MS));
              continue;
            }
            // Transient stream error → reopen on the next cycle.
            if (!cancelledRef.current) setStatus('reconnecting');
          }
        } else {
          // Pulling / building / provisioning: no algorithm container yet → show the build log.
          try {
            const text = await fetchStoredLogsText(token, entry);
            if (!cancelledRef.current) {
              setStatus('live');
              setLines(text ? toLines(text) : [`${entry?.statusText ?? 'Preparing job'}…`]);
            }
          } catch (e: any) {
            if (cancelledRef.current) return;
            if (await reauthed(e)) continue;
            if (isRateLimitError(e)) {
              await backoff(rateLimitBackoffMs(e, RATE_LIMIT_BACKOFF_MS));
              continue;
            }
          }
        }

        if (cancelledRef.current) return;
        await delay(REOPEN_INTERVAL_MS);
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
    // Keyed on job identity + addresses only. The hook reads the node's live status itself, so it must
    // NOT restart when the indexed row's status/statusText churns (that would reset the log view).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isReady, job?.peerId, job?.jobId, job?.environment, job?.environmentId, nodeUriKey]);

  return { lines, status, error, stop };
}
