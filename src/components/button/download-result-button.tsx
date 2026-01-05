import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeJob } from '@/types/jobs';
import { generateAuthTokenWithSmartAccount } from '@/utils/generateAuthToken';
import { useSignMessage, useSmartAccountClient } from '@account-kit/react';
import DownloadIcon from '@mui/icons-material/Download';
import { Alert, IconButton, Snackbar, Tooltip } from '@mui/material';
import { useState } from 'react';

interface DownloadResultButtonProps {
  job: ComputeJob;
}

export const DownloadResultButton = ({ job }: DownloadResultButtonProps) => {
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
      setIsDownloading(true);
      const archive = job.results.find((result: any) => result.filename.includes('.tar'));

      const authToken = await generateAuthTokenWithSmartAccount(job.peerId, account.address, signMessageAsync);

      const result = await getComputeResult(job.peerId, jobId, archive?.index, authToken, account.address);
      if (result instanceof Uint8Array) {
        if (result.byteLength === 0) {
          console.log('Received empty response (0 bytes). Skipping download.');
          return;
        }

        const blob = new Blob([result as any], { type: 'application/octet-stream' });
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
      const errorMessage = e instanceof Error ? e.message : 'Failed to download result';
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
      <Tooltip title={isDownloading ? 'Downloading...' : 'Download result'}>
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
