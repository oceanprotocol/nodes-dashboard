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

// The node streams logs with `follow: true`, so a running service's stream never ends on its own.
// The log is taken as complete once the stream has been quiet for this long…
const IDLE_MS = 2000;
// …or, for a container that never goes quiet, after this long. Longer than the panel's own
// one-off fetch (15s) so a long history has time to arrive in full.
const MAX_MS = 30000;

type DownloadServiceLogsButtonProps = {
  nodePeerId?: string;
  nodeUri: NodeUri | null;
  /** Unix ms after which the node no longer holds this service's logs. Undefined when not known. */
  retentionEndsAt?: number;
  serviceId: string;
  /** The service's status per the page's poll. Undefined until the first poll lands. */
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
 * Saves a service's container logs as a .txt file: the final log of a finished service, or a
 * timestamped snapshot of one that is still running.
 *
 * The log comes from the node in a request of its own, not from the panel's buffer. That buffer keeps
 * only the last few thousand lines, and a separate request leaves the live tail untouched. It reuses
 * the node's cached auth token (withNodeAuth), so no second token is minted.
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
  // Doubles as the in-flight guard: state lands a render late, so two clicks in the same frame
  // would both get past a check on `downloading`.
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the page mid-download must not save a file (or raise a toast) on whatever page is next.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const retentionEnded = isServiceLogsRetentionEnded(retentionEndsAt);

  const handleDownload = async () => {
    if (abortRef.current || !nodeUri || !nodePeerId) {
      return;
    }
    // Checked again at click time: a finished service stops the status poll, so nothing re-renders
    // this button if the window closes while the page sits open.
    if (isServiceLogsRetentionEnded(retentionEndsAt)) {
      toast.error(SERVICE_LOGS_RETENTION_ENDED_NOTE);
      return;
    }
    const abortController = new AbortController();
    abortRef.current = abortController;
    setDownloading(true);

    // A service that hasn't finished keeps logging, so its file is a point-in-time snapshot.
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
      // The node answers 404 when it has no container to read logs from. That is "nothing to
      // download", not a broken request.
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
