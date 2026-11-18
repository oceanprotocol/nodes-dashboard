'use client';

import Button from '@/components/button/button';
import { useNodeTokensContext } from '@/context/node-tokens';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { cleanLogText } from '@/lib/strip-ansi';
import { getServiceLogs } from '@/services/nodeService';
import {
  isServiceLogsRetentionEnded,
  SERVICE_LOGS_RETENTION_ENDED_NOTE,
  serviceLogsFilename,
} from '@/services/service-logs';
import { isServiceTerminal } from '@/services/service-status';
import { formatError } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import { ServiceStatusNumber } from '@oceanprotocol/lib';
import posthog from 'posthog-js';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

// The node follows a running service's log, so its stream never ends on its own: a pause this long
// is the only sign that the history has all arrived.
const IDLE_MS = 2000;
// For a container that never goes quiet. Twice the panel's one-off fetch (15s), because a download
// is meant to hold the whole history, not just a recent page of it.
const MAX_MS = 30000;

type DownloadServiceLogsButtonProps = {
  nodePeerId?: string;
  nodeUri: NodeUri | null;
  /**
   * Unix ms. Past it the button is disabled, since the node has deleted the logs by then. Undefined
   * (unknown) keeps it enabled, so a missing field never blocks logs the node still has.
   */
  retentionEndsAt?: number;
  serviceId: string;
  /** Tells a final log from a snapshot. Undefined until the page's first poll lands. */
  serviceStatus?: ServiceStatusNumber;
};

function saveTextFile(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Fetches the log from the node in a request of its own rather than saving the panel's buffer: that
 * buffer keeps only the last few thousand lines, and a separate request leaves the live tail running.
 * Goes through withNodeAuth so the cached node token is reused: minting another would mean another
 * signature prompt.
 */
const DownloadServiceLogsButton: React.FC<DownloadServiceLogsButtonProps> = ({
  nodePeerId,
  nodeUri,
  retentionEndsAt,
  serviceId,
  serviceStatus,
}) => {
  const { withNodeAuth } = useNodeTokensContext();
  const { isReady } = useP2P();

  const [downloading, setDownloading] = useState(false);
  // The in-flight guard lives in a ref, not in `downloading`: state lands a render late, so two
  // clicks in the same frame would both get past a check on it.
  const abortRef = useRef<AbortController | null>(null);

  // A download must not save a file (or raise a toast) once the user has moved on: leaving the page,
  // or switching the same page to another service, which Next.js does without remounting it.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [serviceId]);

  const retentionEnded = isServiceLogsRetentionEnded(retentionEndsAt);

  const handleDownload = async () => {
    if (abortRef.current || !nodeUri || !nodePeerId) {
      return;
    }
    // Checked again at click time: browsers delay timers in background tabs, so the page's re-check
    // at the deadline may not have re-rendered this button yet.
    if (isServiceLogsRetentionEnded(retentionEndsAt)) {
      toast.error(SERVICE_LOGS_RETENTION_ENDED_NOTE);
      return;
    }
    const abortController = new AbortController();
    abortRef.current = abortController;
    setDownloading(true);

    // A service that hasn't finished keeps logging, so its file is only a snapshot and is named as one.
    const isSnapshot = !isServiceTerminal(serviceStatus);
    const noLogsMessage = isSnapshot
      ? 'This service has not produced any logs yet.'
      : 'The node has no logs for this service.';

    try {
      const raw = await withNodeAuth(nodePeerId, nodeUri, (token) =>
        getServiceLogs(nodeUri, token, serviceId, undefined, {
          idleMs: IDLE_MS,
          maxMs: MAX_MS,
          signal: abortController.signal,
          throwOnError: true,
        })
      );
      if (abortController.signal.aborted) {
        return;
      }
      const text = cleanLogText(raw);
      if (!text.trim()) {
        toast.error(noLogsMessage);
        return;
      }
      saveTextFile(serviceLogsFilename(serviceId, isSnapshot), text);
      posthog.capture('inference_service_logs_downloaded', { serviceId, status: serviceStatus, isSnapshot });
      toast.success(isSnapshot ? 'Log snapshot sent to your downloads.' : 'Logs sent to your downloads.');
    } catch (e) {
      if (abortController.signal.aborted) {
        return;
      }
      console.error('Failed to download service logs:', e);
      // A 404 means the node has neither a container nor saved logs for this service: there is
      // nothing to download, which deserves the no-logs message rather than an error.
      const { httpStatus, status } = (e ?? {}) as { httpStatus?: number; status?: number };
      toast.error(
        (httpStatus ?? status) === 404
          ? noLogsMessage
          : formatError({ error: e, fallback: 'The logs could not be downloaded.' })
      );
    } finally {
      abortRef.current = null;
      setDownloading(false);
    }
  };

  return (
    <Button
      color="accent1"
      contentBefore={downloading ? null : <DownloadIcon />}
      disabled={!isReady || !nodeUri || !nodePeerId || retentionEnded}
      loading={downloading}
      onClick={handleDownload}
      size="sm"
      variant="outlined"
    >
      {downloading ? 'Downloading…' : 'Download logs'}
    </Button>
  );
};

export default DownloadServiceLogsButton;
