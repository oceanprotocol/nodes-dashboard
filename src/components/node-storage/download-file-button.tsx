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
 * Downloads one persistent-storage file. The bytes arrive over P2P, so they land in page JavaScript
 * and there is no URL for the browser to fetch on its own: they are collected here and handed over as
 * a Blob, which is what puts the file in the browser's own download manager (progress row, "show in
 * folder"). Same approach as the compute logs/results buttons — and the same ceiling, since the whole
 * file passes through tab memory.
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
      const stream = await downloadFile({
        bucketId,
        fileName: file.name,
        nodeId,
        nodeUri,
        signal: abortController.signal,
      });

      const chunks: Uint8Array[] = [];
      let received = 0;
      for await (const chunk of stream) {
        chunks.push(chunk);
        received += chunk.byteLength;
        setBytesReceived(received);
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

      // An empty file is a legitimate download, so only a short read against a known size is a warning.
      if (file.size > 0 && received < file.size) {
        const pct = ((received / file.size) * 100).toFixed(1);
        toast.warning(`${file.name} may be incomplete: received ${pct}% of the expected size.`);
      }
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
  // the label instead. It matters because a Blob download only reaches the browser's own progress UI
  // once every byte has arrived — until then this is the only feedback there is.
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
