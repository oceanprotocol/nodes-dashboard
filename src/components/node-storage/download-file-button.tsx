'use client';

import Button, { ButtonProps } from '@/components/button/button';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { formatError } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import { PersistentStorageFileEntry } from '@oceanprotocol/lib';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

type DownloadFileButtonProps = {
  bucketId: string;
  className?: string;
  /** The listed entry — its `size` gives the progress total and its `name` the saved file name. */
  file: PersistentStorageFileEntry;
  /** Renders just the icon (no label) for rows too tight to carry one. */
  iconOnly?: boolean;
  nodeId: string;
  nodeUri: NodeUri;
  size?: ButtonProps['size'];
};

/**
 * Files at or under this go through the Blob path, so they land in the browser's own download manager
 * (a row in chrome://downloads, "show in folder"). Above it the Blob path is the one that can't be
 * used: buffering peaks at roughly twice the file size (the chunk array plus the Blob's copy of it),
 * so 512MB already means ~1GB of tab memory, and the transfer switches to a streaming save instead.
 */
const MAX_BUFFERED_DOWNLOAD_BYTES = 512 * 1024 * 1024;

/** How many times a short read is reopened from its byte offset before giving up. */
const MAX_RESUME_ATTEMPTS = 3;

/**
 * Downloads one persistent-storage file. The bytes arrive over P2P, so they land in page JavaScript
 * and there is no URL for the browser to fetch on its own.
 *
 * Default path buffers the file and hands it over as a Blob, the same as the compute logs/results
 * buttons. That is what puts the file in the browser's own download manager (progress row, "show in
 * folder"), which a streaming save does not do, so it is worth the memory for ordinary files.
 *
 * Above MAX_BUFFERED_DOWNLOAD_BYTES that memory cost stops being payable, and the transfer switches
 * to the File System Access API: the user picks the destination up front and chunks go straight to
 * disk, so tab memory holds one chunk at a time. Those files get no download-manager row. Browsers
 * without `showSaveFilePicker` (Firefox, Safari) have neither option for a file that size, so it is
 * refused up front rather than killing the tab partway through.
 *
 * A short read never reaches disk as a truncated file: the stream is checked against the listed size
 * and resumed from where it stopped (the node takes a byte offset), and only a complete download is
 * saved.
 */
const DownloadFileButton: React.FC<DownloadFileButtonProps> = ({
  bucketId,
  className,
  file,
  iconOnly,
  nodeId,
  nodeUri,
  size = 'sm',
}) => {
  const { downloadFile } = useNodeStorage();
  // Bucket calls go over the P2P node, which sets itself up after mount.
  const { isReady: isP2PReady } = useP2P();

  const [downloading, setDownloading] = useState(false);
  const [bytesReceived, setBytesReceived] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  // Leaving the page mid-transfer must tear the stream down, or the node keeps producing a body
  // nobody drains.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const percent = file.size > 0 ? Math.min(100, Math.floor((bytesReceived / file.size) * 100)) : 0;

  const handleDownload = async () => {
    if (downloading) {
      return;
    }
    const abortController = new AbortController();
    abortRef.current = abortController;
    setDownloading(true);
    setBytesReceived(0);

    try {
      // Small files keep the Blob path purely so they show up in the browser's download manager —
      // a streaming save writes to a path the browser isn't tracking, so it never appears there.
      // Only files too big to buffer give that up. A listing with no size (0) is treated as small;
      // it's the common case for an unknown size and the drain below still can't overrun memory
      // silently, since a wrong guess just means the buffered path for a file that turns out large.
      const needsStreamingSave = file.size > MAX_BUFFERED_DOWNLOAD_BYTES;

      const showSaveFilePicker = (window as any).showSaveFilePicker as
        | ((options?: any) => Promise<FileSystemFileHandle>)
        | undefined;

      let fileHandle: FileSystemFileHandle | null = null;
      if (needsStreamingSave && typeof showSaveFilePicker === 'function') {
        try {
          fileHandle = await showSaveFilePicker({ suggestedName: file.name });
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            return; // user cancelled the native save dialog
          }
          // SecurityError or similar — fall through, and the size guard below refuses the download.
        }
      }

      // Too big for the Blob path and no streaming sink to fall back on (Firefox, Safari, or a
      // picker that threw): refuse up front rather than letting the tab die partway through.
      if (needsStreamingSave && !fileHandle) {
        const limitMb = Math.round(MAX_BUFFERED_DOWNLOAD_BYTES / 1024 ** 2);
        toast.error(
          `${file.name} is larger than ${limitMb} MB, which this browser can't download. ` +
            `Use a browser that supports choosing a save location, such as Chrome or Edge.`
        );
        return;
      }

      // Drains the stream into `sink`, resuming from a short read: the node accepts a byte offset, so
      // a stream that stops early is reopened from where it stopped instead of saving a truncated
      // file. Bounded so a node that keeps returning nothing can't spin here forever.
      const drainWithResume = async (sink: (chunk: Uint8Array) => Promise<void> | void) => {
        let received = 0;
        let attempts = 0;
        while (attempts < MAX_RESUME_ATTEMPTS) {
          attempts += 1;
          const before = received;
          const stream = await downloadFile({
            bucketId,
            fileName: file.name,
            nodeId,
            nodeUri,
            offset: received,
            signal: abortController.signal,
          });

          for await (const chunk of stream) {
            await sink(chunk);
            received += chunk.byteLength;
            setBytesReceived(received);
          }

          // Size unknown, or everything the listing promised has arrived.
          if (file.size <= 0 || received >= file.size) {
            return received;
          }
          // A resume that yielded nothing new won't do better on another pass.
          if (received === before) {
            break;
          }
        }
        return received;
      };

      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        let received = 0;
        try {
          received = await drainWithResume((chunk) => writable.write(chunk as unknown as ArrayBuffer));
        } catch (e) {
          // Abandon the partial file rather than leaving a truncated one at the chosen path.
          await writable.abort().catch(() => {});
          throw e;
        }

        if (file.size > 0 && received < file.size) {
          await writable.abort().catch(() => {});
          const pct = ((received / file.size) * 100).toFixed(1);
          toast.error(
            `${file.name} could not be downloaded completely: received ${pct}% of the expected size. ` +
              `The partial file was discarded, please try again.`
          );
          return;
        }

        await writable.close();
        toast.success(`${file.name} downloaded.`);
        return;
      }

      const chunks: Uint8Array[] = [];
      const received = await drainWithResume((chunk) => {
        chunks.push(chunk);
      });

      // Nothing is saved unless the download is complete, so a truncated file never reaches the disk.
      // An empty file is a legitimate download, so only a short read against a known size is a failure.
      if (file.size > 0 && received < file.size) {
        const pct = ((received / file.size) * 100).toFixed(1);
        toast.error(
          `${file.name} could not be downloaded completely: received ${pct}% of the expected size. ` +
            `Nothing was saved, please try again.`
        );
        return;
      }

      const blob = new Blob(chunks as unknown as BlobPart[], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      if (e instanceof Error && e.name === 'AbortError') {
        return;
      }
      toast.error(formatError({ error: e, fallback: 'Your file could not be downloaded.' }));
    } finally {
      abortRef.current = null;
      setDownloading(false);
      setBytesReceived(0);
    }
  };

  // Both call sites are single table-ish rows with no room for a ProgressBar, so progress rides on
  // the label instead. It matters because neither path shows browser-native progress while the bytes
  // are arriving: the streaming path writes to a file the browser isn't tracking as a download, and
  // the Blob path only reaches the download manager once every byte is in. Until then this is the
  // only feedback there is.
  const label = downloading && file.size > 0 ? `${percent}%` : 'Download';

  return (
    <Button
      aria-label={iconOnly ? `Download ${file.name}` : undefined}
      className={className}
      color="accent1"
      contentBefore={downloading ? null : <DownloadIcon />}
      disabled={!isP2PReady}
      loading={downloading}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        handleDownload();
      }}
      size={size}
      variant="transparent"
    >
      {iconOnly && !downloading ? null : label}
    </Button>
  );
};

export default DownloadFileButton;
