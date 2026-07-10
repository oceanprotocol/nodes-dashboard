import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { useNodeAuth } from '@/contexts/node-auth-context';
import { buildNodeJobId } from '@/lib/build-node-job-id';
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

// The node's docker follow-stream replays the FULL history on every connection,
// so treating each connection's output as the complete log (rather than an
// incremental append across reconnects) avoids duplicated lines.
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

      let statusFailures = 0;

      while (!cancelledRef.current) {
        let entry: any;
        try {
          entry = await fetchStatusEntry(token);
          statusFailures = 0;
        } catch (e: any) {
          if (cancelledRef.current) return;
          if (await reauthed(e)) continue;
          statusFailures += 1;
          if (statusFailures >= MAX_CONSECUTIVE_FAILURES) {
            if (!cancelledRef.current) {
              setStatus('error');
              setError('Lost connection to the node.');
            }
            return;
          }
          if (!cancelledRef.current) setStatus('reconnecting');
          await delay(RECONNECT_DELAY_MS);
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
          // Algorithm container is up → live-tail its stdout until the stream ends, then re-check status.
          try {
            const controller = new AbortController();
            abortRef.current = controller;
            const generator = await streamComputeLogs(nodeUri, token, jobId, controller.signal);
            if (cancelledRef.current) return;
            setStatus('live');
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            for await (const chunk of generator) {
              if (cancelledRef.current) return;
              buffer += decoder.decode(chunk, { stream: true });
              setLines(toLines(buffer));
            }
            buffer += decoder.decode();
            if (buffer) setLines(toLines(buffer));
          } catch (e: any) {
            if (cancelledRef.current) return;
            if (await reauthed(e)) continue;
            // transient stream error — re-check status and retry on the next loop
          }
        } else {
          // Pulling / building / provisioning: no container yet, so follow the stored build log.
          try {
            const text = await fetchStoredLogsText(token, entry);
            if (!cancelledRef.current) {
              setStatus('live');
              setLines(text ? toLines(text) : [`${entry?.statusText ?? 'Preparing job'}…`]);
            }
          } catch (e: any) {
            if (cancelledRef.current) return;
            if (await reauthed(e)) continue;
          }
        }

        if (cancelledRef.current) return;
        await delay(RECONNECT_DELAY_MS);
      }
    };

    run();

    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
    // Keyed on job identity + addresses only. The hook polls the node's live status itself, so it must
    // NOT restart when the indexed row's status/statusText churns (that would reset the log view).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isReady, job?.peerId, job?.jobId, job?.environment, job?.environmentId, nodeUriKey]);

  return { lines, status, error, stop };
}
