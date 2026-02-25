import Button from '@/components/button/button';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeJob } from '@/types/jobs';
import { generateAuthToken } from '@/utils/generateAuthToken';
import DownloadIcon from '@mui/icons-material/Download';
import JSZip from 'jszip';
import { useState } from 'react';
import { toast } from 'react-toastify';

interface DownloadLogsButtonProps {
  job: ComputeJob;
}

export const DownloadLogsButton = ({ job }: DownloadLogsButtonProps) => {
  const { account, signMessage } = useOceanAccount();
  const { getComputeResult, getComputeJobStatus, isReady } = useP2P();

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!isReady || isDownloading || !account?.address) return;

    try {
      const jobId = (job.environment ?? job.environmentId).split('-')[0] + '-' + job.jobId;

      const authToken = await generateAuthToken(job.peerId, account.address, signMessage);

      const jobStatus = await getComputeJobStatus(job.peerId, jobId, account.address);

      const logFiles = jobStatus?.[0]?.results?.filter((result: any) => result.filename.includes('.log'));
      const logPromises = logFiles?.map((logFile: any) =>
        getComputeResult(job.peerId, jobId, logFile.index, authToken, account.address!)
      );

      const downloadedLogs = await Promise.all(logPromises);
      setIsDownloading(true);

      const zip = new JSZip();

      downloadedLogs.forEach((logData, index) => {
        if (logData instanceof Uint8Array) {
          if (logData.byteLength !== 0) {
            zip.file(logFiles[index].filename, logData);
          }
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `logs-${job.jobId}.zip`;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to download logs';
      toast.error(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
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
  );
};
