'use client';

import Button from '@/components/button/button';
import { useNodeTokensContext } from '@/context/node-tokens';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { streamServiceResult } from '@/services/nodeService';
import { formatBytes, formatError } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

type DownloadServiceResultButtonProps = {
  /** An archive's size (from `outputArchives`), or 0 for a live zip — whose size isn't known up front. */
  filesize: number;
  /** An archive index, or `'live'` for a zip of the running container's /data/outputs. */
  index: number | 'live';
  label: string;
  nodePeerId: string;
  nodeUri: NodeUri;
  serviceId: string;
  /** Name the zip is saved under. */
  suggestedName: string;
};

/** Same threshold as the bucket file download: above it, buffering the zip would cost ~2× its size in tab memory. */
const MAX_BUFFERED_DOWNLOAD_BYTES = 512 * 1024 * 1024;

/** How many times a short archive read is reopened from its byte offset before giving up. */
const MAX_RESUME_ATTEMPTS = 3;

/**
 * Downloads a service's /data/outputs zip — one of its archives, or a live zip of the running
 * container. Modelled on the bucket file download (DownloadFileButton): small archives are buffered
 * into a Blob so they land in the browser's download manager, large ones stream straight to a file the
 * user picks, and an archive that arrives short is resumed from its byte offset and only saved whole.
 *
 * A live zip is built by the node as it's read, so it has no size to check against and can't be
 * resumed: it streams to a picked file where the browser supports that (its size is unknown, so it
 * might be large), and is buffered otherwise.
 */
const DownloadServiceResultButton: React.FC<DownloadServiceResultButtonProps> = ({
  filesize,
  index,
  label,
  nodePeerId,
  nodeUri,
  serviceId,
  suggestedName,
}) => {
  const { withNodeAuth } = useNodeTokensContext();
  const { isReady } = useP2P();

  const [downloading, setDownloading] = useState(false);
  const [bytesReceived, setBytesReceived] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the page mid-transfer must tear the stream down, or the node keeps producing a zip nobody drains.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const isLive = index === 'live';

  const handleDownload = async () => {
    if (downloading) {
      return;
    }
    const abortController = new AbortController();
    abortRef.current = abortController;
    setDownloading(true);
    setBytesReceived(0);

    try {
      const needsStreamingSave = isLive || filesize > MAX_BUFFERED_DOWNLOAD_BYTES;
      const showSaveFilePicker = (window as any).showSaveFilePicker as
        ((options?: any) => Promise<FileSystemFileHandle>) | undefined;

      let fileHandle: FileSystemFileHandle | null = null;
      if (needsStreamingSave && typeof showSaveFilePicker === 'function') {
        try {
          fileHandle = await showSaveFilePicker({
            suggestedName,
            types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
          });
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            return; // user cancelled the native save dialog
          }
          // SecurityError or similar — fall through to the checks below.
        }
      }

      // A known-large archive with no streaming sink (Firefox, Safari): refuse rather than kill the tab.
      // A live zip still goes through the buffer — its size is unknown, most are small.
      if (!isLive && needsStreamingSave && !fileHandle) {
        const limitMb = Math.round(MAX_BUFFERED_DOWNLOAD_BYTES / 1024 ** 2);
        toast.error(
          `This archive is larger than ${limitMb} MB, which this browser can't download. ` +
            `Use a browser that supports choosing a save location, such as Chrome or Edge.`
        );
        return;
      }

      const open = (offset: number) =>
        withNodeAuth(nodePeerId, nodeUri, (token) =>
          streamServiceResult({ authToken: token, index, nodeUri, offset, serviceId, signal: abortController.signal })
        );

      // Drains the zip into `sink`. An archive that stops early is reopened from where it stopped (the
      // node takes a byte offset); a live zip is one pass, since each request builds a new one.
      const drain = async (sink: (chunk: Uint8Array) => Promise<void> | void) => {
        let received = 0;
        let attempts = 0;
        while (attempts < (isLive ? 1 : MAX_RESUME_ATTEMPTS)) {
          attempts += 1;
          const before = received;
          for await (const chunk of await open(received)) {
            await sink(chunk);
            received += chunk.byteLength;
            setBytesReceived(received);
          }
          if (isLive || filesize <= 0 || received >= filesize) {
            return received;
          }
          if (received === before) {
            break;
          }
        }
        return received;
      };

      const incomplete = (received: number) => !isLive && filesize > 0 && received < filesize;
      const incompleteMessage = (received: number, discarded: string) =>
        `The results could not be downloaded completely: received ${((received / filesize) * 100).toFixed(1)}% ` +
        `of the expected size. ${discarded}, please try again.`;

      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        let received = 0;
        try {
          received = await drain((chunk) => writable.write(chunk as unknown as ArrayBuffer));
        } catch (e) {
          await writable.abort().catch(() => {});
          throw e;
        }
        if (incomplete(received)) {
          await writable.abort().catch(() => {});
          toast.error(incompleteMessage(received, 'The partial file was discarded'));
          return;
        }
        await writable.close();
        toast.success('Results downloaded.');
        return;
      }

      const chunks: Uint8Array[] = [];
      const received = await drain((chunk) => {
        chunks.push(chunk);
      });
      if (incomplete(received)) {
        toast.error(incompleteMessage(received, 'Nothing was saved'));
        return;
      }
      const blob = new Blob(chunks as unknown as BlobPart[], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = suggestedName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      if (e instanceof Error && e.name === 'AbortError') {
        return;
      }
      toast.error(formatError({ error: e, fallback: 'The results could not be downloaded.' }));
    } finally {
      abortRef.current = null;
      setDownloading(false);
      setBytesReceived(0);
    }
  };

  const percent = filesize > 0 ? Math.min(100, Math.floor((bytesReceived / filesize) * 100)) : 0;
  // A live zip has no total, so its progress is the byte count.
  const progressLabel = isLive ? formatBytes(bytesReceived) : `${percent}%`;

  return (
    <Button
      color="accent1"
      contentBefore={downloading ? null : <DownloadIcon />}
      disabled={!isReady}
      loading={downloading}
      onClick={handleDownload}
      size="sm"
      variant="outlined"
    >
      {downloading ? progressLabel : label}
    </Button>
  );
};

export default DownloadServiceResultButton;
