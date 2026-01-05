import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeJob } from '@/types/jobs';
import { generateAuthTokenWithSmartAccount } from '@/utils/generateAuthToken';
import { useSignMessage, useSmartAccountClient } from '@account-kit/react';
import DownloadIcon from '@mui/icons-material/Download';
import { Alert, IconButton, Snackbar, Tooltip } from '@mui/material';
import JSZip from 'jszip';
import { useState } from 'react';

interface DownloadLogsButtonProps {
  job: ComputeJob;
}

export const DownloadLogsButton = ({ job }: DownloadLogsButtonProps) => {
  const { getComputeResult, isReady } = useP2P();
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { client } = useSmartAccountClient({ type: 'LightAccount' });
  const { signMessageAsync } = useSignMessage({
    client,
  });
  const { account } = useOceanAccount();

  const handleDownload = async () => {
    if (!isReady || isDownloading || !account?.address) return;

    setError(null);

    try {
      const jobId = job.environment.split('-')[0] + '-' + job.jobId;

      const authToken = await generateAuthTokenWithSmartAccount(job.peerId, account.address, signMessageAsync);

      const logFiles = job.results.filter((result: any) => result.filename.includes('.log'));
      const logPromises = logFiles.map((logFile: any) =>
        getComputeResult(job.peerId, jobId, logFile.index, authToken, account.address)
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
      setError(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCloseError = () => {
    setError(null);
  };
  return (
    <>
      <Tooltip title={isDownloading ? 'Downloading...' : 'Download logs'}>
        <span>
          <IconButton onClick={handleDownload} disabled={!isReady || isDownloading} size="small" color="primary">
            <DownloadIcon />
          </IconButton>
        </span>
      </Tooltip>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={handleCloseError}>
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};
