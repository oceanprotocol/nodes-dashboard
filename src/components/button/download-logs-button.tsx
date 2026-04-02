import Button from '@/components/button/button';
import ProgressBar from '@/components/progress-bar/progress-bar';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { createAuthToken } from '@/services/nodeService';
import { ComputeJob } from '@/types/jobs';
import DownloadIcon from '@mui/icons-material/Download';
import JSZip from 'jszip';
import { useRef, useState } from 'react';
import { toast } from 'react-toastify';

interface DownloadLogsButtonProps {
  job: ComputeJob;
}

export const DownloadLogsButton = ({ job }: DownloadLogsButtonProps) => {
  const { account, signMessage } = useOceanAccount();
  const { getComputeJobStatus, isReady, streamComputeResult } = useP2P();

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleDownload = async () => {
    if (!isReady || isDownloading || !account?.address) return;

    try {
      const jobId = (job.environment ?? job.environmentId).split('-')[0] + '-' + job.jobId;
      setIsDownloading(true);

      const { token } = await createAuthToken({
        consumerAddress: account.address,
        peerId: job.peerId,
        signMessage,
      });

      const jobStatus = await getComputeJobStatus(job.peerId, jobId, account.address);
      const logFiles: any[] = jobStatus?.[0]?.results?.filter((result: any) => result.filename.includes('.log')) ?? [];

      if (logFiles.length === 0) {
        toast.error('No log files found for this job');
        return;
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      setDownloadProgress({ current: 0, total: logFiles.length });

      const zip = new JSZip();

      for (let i = 0; i < logFiles.length; i++) {
        setDownloadProgress({ current: i, total: logFiles.length });

        const generator = streamComputeResult(
          job.peerId,
          jobId,
          logFiles[i].index,
          token,
          account.address,
          abortController.signal,
          logFiles[i].filesize ?? 0
        );

        const chunks: Uint8Array[] = [];
        for await (const chunk of generator) {
          chunks.push(chunk);
        }

        if (chunks.length > 0) {
          zip.file(logFiles[i].filename, new Blob(chunks as unknown as BlobPart[]));
        }

        setDownloadProgress({ current: i + 1, total: logFiles.length });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `logs-${job.jobId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Logs downloaded successfully');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        toast.error('Download cancelled');
        return;
      }
      const errorMessage = e instanceof Error ? e.message : 'Failed to download logs';
      toast.error(errorMessage);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
      abortRef.current = null;
    }
  };

  const progressPercent =
    downloadProgress && downloadProgress.total > 0
      ? Math.min(100, Math.floor((downloadProgress.current / downloadProgress.total) * 100))
      : 0;

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
        Logs
      </Button>
      {downloadProgress !== null && (
        <ProgressBar
          topLeftContent={`Downloading log ${downloadProgress.current + 1} of ${downloadProgress.total}…`}
          topRightContent={`${progressPercent}%`}
          value={progressPercent}
        />
      )}
    </div>
  );
};
