import Button from '@/components/button/button';
import ProgressBar from '@/components/progress-bar/progress-bar';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { createAuthToken } from '@/services/nodeService';
import { ComputeJob } from '@/types/jobs';
import DownloadIcon from '@mui/icons-material/Download';
import { useRef, useState } from 'react';
import { toast } from 'react-toastify';

interface DownloadResultButtonProps {
  job: ComputeJob;
}

export const DownloadResultButton = ({ job }: DownloadResultButtonProps) => {
  const { account, signMessage } = useOceanAccount();
  const { getComputeJobStatus, isReady, streamComputeResult } = useP2P();

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ bytes: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleDownload = async () => {
    if (!isReady || isDownloading || !account?.address) return;

    try {
      const jobId = (job.environment ?? job.environmentId).split('-')[0] + '-' + job.jobId;
      setIsDownloading(true);

      const jobStatus = await getComputeJobStatus(job.peerId, jobId, account.address);
      const archive = jobStatus?.[0]?.results?.find((result: any) => result.filename.includes('.tar'));
      const filesize: number = archive?.filesize ?? 0;

      const { token } = await createAuthToken({
        consumerAddress: account.address,
        multiaddrsOrPeerId: job.peerId,
        signMessage,
      });

      const abortController = new AbortController();
      abortRef.current = abortController;

      setDownloadProgress({ bytes: 0, total: filesize });

      const generator = streamComputeResult(
        job.peerId,
        jobId,
        archive?.index,
        token,
        account.address,
        abortController.signal
      );

      const showSaveFilePicker = (window as any).showSaveFilePicker as
        | ((options?: any) => Promise<FileSystemFileHandle>)
        | undefined;

      let usedFSA = false;

      if (typeof showSaveFilePicker === 'function') {
        let fileHandle: FileSystemFileHandle | null = null;
        try {
          fileHandle = await showSaveFilePicker({
            suggestedName: `outputs-${job.jobId}.tar`,
            types: [{ description: 'TAR archive', accept: { 'application/x-tar': ['.tar'] } }],
          });
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') {
            return; // user cancelled the native save dialog
          }
          // SecurityError or other — fall through to buffered path
        }

        if (fileHandle) {
          usedFSA = true;
          const writable = await fileHandle.createWritable();
          let bytesReceived = 0;
          try {
            for await (const chunk of generator) {
              await writable.write(chunk as unknown as ArrayBuffer);
              bytesReceived += chunk.byteLength;
              setDownloadProgress({ bytes: bytesReceived, total: filesize });
            }
            await writable.close();
          } catch (e) {
            await writable.abort().catch(() => {});
            throw e;
          }

          if (filesize > 0 && bytesReceived < filesize) {
            const pct = ((bytesReceived / filesize) * 100).toFixed(1);
            toast.warning(`Download may be incomplete: received ${pct}% of expected size`);
          }
        }
      }

      if (!usedFSA) {
        // Fallback: buffer chunks in memory then trigger blob download
        const chunks: Uint8Array[] = [];
        let bytesReceived = 0;
        for await (const chunk of generator) {
          chunks.push(chunk);
          bytesReceived += chunk.byteLength;
          setDownloadProgress({ bytes: bytesReceived, total: filesize });
        }

        if (bytesReceived === 0) {
          console.log('Received empty response (0 bytes). Skipping download.');
          return;
        }

        if (filesize > 0 && bytesReceived < filesize) {
          const pct = ((bytesReceived / filesize) * 100).toFixed(1);
          toast.warning(`Download may be incomplete: received ${pct}% of expected size`);
        }

        const blob = new Blob(chunks as unknown as BlobPart[], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `outputs-${job.jobId}.tar`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        toast.error('Download cancelled');
        return;
      }
      const errorMessage = e instanceof Error ? e.message : 'Failed to download result';
      toast.error(errorMessage);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
      abortRef.current = null;
    }
  };

  const progressPercent =
    downloadProgress && downloadProgress.total > 0
      ? Math.min(100, Math.floor((downloadProgress.bytes / downloadProgress.total) * 100))
      : 0;

  const isIndeterminate = downloadProgress !== null && downloadProgress.total === 0;

  return (
    <div>
      <Button
        autoLoading
        color="accent1"
        contentBefore={<DownloadIcon />}
        disabled={!isReady}
        onClick={handleDownload}
        size="md"
        variant="outlined"
      >
        Results
      </Button>
      {downloadProgress !== null && (
        <ProgressBar
          topLeftContent="Downloading..."
          topRightContent={isIndeterminate ? undefined : `${progressPercent}%`}
          value={progressPercent}
          variant={isIndeterminate ? 'indeterminate' : 'determinate'}
        />
      )}
    </div>
  );
};
