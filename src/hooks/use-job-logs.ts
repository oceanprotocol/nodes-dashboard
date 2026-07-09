import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { useNodeAuth } from '@/contexts/node-auth-context';
import { cleanLogText } from '@/lib/strip-ansi';
import { ComputeJob } from '@/types/jobs';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LogViewStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'loading-result' | 'ended' | 'error';

const MAX_LINES = 5000;
// A "failure" is a connection that ended/threw without producing any data while
// the job is still running (e.g. an idle-read timeout). Bail after this many in
// a row so an unreachable node doesn't spin the reconnect loop forever.
const MAX_CONSECUTIVE_FAILURES = 5;
const RECONNECT_DELAY_MS = 1500;

function buildJobId(job: ComputeJob): string {
  return (job.environment ?? job.environmentId).split('-')[0] + '-' + job.jobId;
}

// The node's docker follow-stream replays the FULL history on every connection,
// so treating each connection's output as the complete log (rather than an
// incremental append across reconnects) avoids duplicated lines.
function statusIsTerminal(entry: any): boolean {
  if (!entry) return false;
  const text = typeof entry.statusText === 'string' ? entry.statusText.toLowerCase() : '';
  if (/complet|finish|fail|error|timeout|stopped|removed/.test(text)) return true;
  if (typeof entry.status === 'number' && entry.status >= 70) return true;
  if (Array.isArray(entry.results) && entry.results.length > 0) return true;
  return false;
}

function jobStartsRunning(job: ComputeJob): boolean {
  if (job.isRunning) return true;
  const text = typeof job.statusText === 'string' ? job.statusText.toLowerCase() : '';
  if (/run|start|provision|warm|pending|queue/.test(text)) return true;
  // Numeric compute status < 70 means not yet finished.
  if (typeof job.status === 'number' && job.status > 0 && job.status < 70) return true;
  return false;
}

interface UseJobLogsResult {
  lines: string[];
  status: LogViewStatus;
  error: string | null;
  stop: () => void;
}

// Streams live logs for a running job (with status-checked reconnect) and
// renders stored .log files for a completed/failed job. See docs/adr/0004.
export function useJobLogs(job: ComputeJob | null, open: boolean, nodeUri: NodeUri): UseJobLogsResult {
  const { isReady, streamComputeLogs, streamComputeResult, getComputeJobStatus } = useP2P();
  const { getNodeToken, clearNodeToken } = useNodeAuth();

  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<LogViewStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

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

    const jobId = buildJobId(job);
    // Auth tokens are cached per node by peerId; the P2P calls dial via `nodeUri` (multiaddrs).
    const nodeId = job.peerId;

    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const toLines = (fullText: string): string[] => {
      const cleaned = cleanLogText(fullText);
      const all = cleaned.split('\n');
      return all.length > MAX_LINES ? all.slice(all.length - MAX_LINES) : all;
    };

    const isStillRunning = async (token: string): Promise<boolean> => {
      try {
        const result: any = await getComputeJobStatus(nodeUri, jobId, token);
        const entry = Array.isArray(result) ? result[0] : result;
        return !statusIsTerminal(entry);
      } catch {
        // If we can't read status, assume terminal to avoid an infinite retry.
        return false;
      }
    };

    const loadStoredLogs = async (token: string): Promise<void> => {
      setStatus('loading-result');
      const result: any = await getComputeJobStatus(nodeUri, jobId, token);
      const entry = Array.isArray(result) ? result[0] : result;
      const logFiles: any[] = (entry?.results ?? []).filter((r: any) => r?.filename?.includes('.log'));
      if (logFiles.length === 0) {
        if (!cancelledRef.current) {
          setLines((prev) => (prev.length ? prev : ['No logs available for this job.']));
          setStatus('ended');
        }
        return;
      }
      const decoder = new TextDecoder('utf-8');
      let text = '';
      for (const file of logFiles) {
        if (cancelledRef.current) return;
        text += `\n===== ${file.filename} =====\n`;
        const generator = await streamComputeResult(nodeUri, token, jobId, file.index);
        for await (const chunk of generator) {
          if (cancelledRef.current) return;
          text += decoder.decode(chunk, { stream: true });
        }
        text += decoder.decode();
      }
      if (!cancelledRef.current) {
        setLines(toLines(text));
        setStatus('ended');
      }
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

      if (!jobStartsRunning(job)) {
        try {
          await loadStoredLogs(token);
        } catch (e) {
          if (!cancelledRef.current) {
            setStatus('error');
            setError(e instanceof Error ? e.message : 'Failed to load logs');
          }
        }
        return;
      }

      // Running job: live tail with status-checked reconnect.
      let consecutiveFailures = 0;
      while (!cancelledRef.current) {
        let producedData = false;
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        try {
          const controller = new AbortController();
          abortRef.current = controller;
          const generator = await streamComputeLogs(nodeUri, token, jobId, controller.signal);
          if (cancelledRef.current) return;
          setStatus('live');
          for await (const chunk of generator) {
            if (cancelledRef.current) return;
            producedData = true;
            buffer += decoder.decode(chunk, { stream: true });
            setLines(toLines(buffer));
          }
          buffer += decoder.decode();
          if (buffer) setLines(toLines(buffer));
        } catch (e: any) {
          if (cancelledRef.current) return;
          const msg = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
          const authFailed =
            e?.status === 401 || e?.httpStatus === 401 || /unauthori[sz]ed|token.*expired|invalid token/.test(msg);
          if (authFailed) {
            clearNodeToken(nodeId);
            try {
              token = await getNodeToken(nodeId, nodeUri);
            } catch (refreshErr) {
              // Without a valid token every follow-up call fails too — surface it instead of
              // letting the status check "assume terminal" and silently show 'ended'.
              if (!cancelledRef.current) {
                setStatus('error');
                setError(refreshErr instanceof Error ? refreshErr.message : 'Failed to re-authenticate with node');
              }
              return;
            }
          }
        }

        if (cancelledRef.current) return;

        // Disambiguate stream-end: job finished vs transient idle timeout.
        if (!(await isStillRunning(token))) {
          try {
            await loadStoredLogs(token);
          } catch (e) {
            if (!cancelledRef.current) {
              setStatus('error');
              setError(e instanceof Error ? e.message : 'Failed to load stored logs');
            }
          }
          return;
        }

        consecutiveFailures = producedData ? 0 : consecutiveFailures + 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          if (!cancelledRef.current) {
            setStatus('error');
            setError('Lost connection to the log stream.');
          }
          return;
        }

        if (!cancelledRef.current) setStatus('reconnecting');
        await delay(RECONNECT_DELAY_MS);
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
    // Re-run when the opened job changes (peerId+jobId identify it uniquely) or when the node's
    // multiaddrs resolve (nodeUri), so the stream dials via addresses instead of a bare peerId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isReady, job?.peerId, job?.jobId, nodeUri]);

  return { lines, status, error, stop };
}
