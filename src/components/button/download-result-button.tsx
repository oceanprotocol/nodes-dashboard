import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeJob } from '@/types/jobs';
import { useSignMessage, useSmartAccountClient } from '@account-kit/react';
import DownloadIcon from '@mui/icons-material/Download';
import { IconButton, Tooltip } from '@mui/material';
import { useState } from 'react';

interface DownloadResultButtonProps {
  job: ComputeJob;
}

export const DownloadResultButton = ({ job }: DownloadResultButtonProps) => {
  const { getComputeResult, isReady } = useP2P();
  const [isDownloading, setIsDownloading] = useState(false);
  const { client } = useSmartAccountClient({ type: 'LightAccount' });
  const { signMessageAsync } = useSignMessage({
    client,
  });
  const { account } = useOceanAccount();

  const handleDownload = async () => {
    if (!isReady || isDownloading || !account?.address) return;

    try {
      setIsDownloading(true);
      const archive = job.results.find((result: any) => result.filename.includes('.tar'));

      const timestamp = Date.now() + 5 * 60 * 1000;
      const signature = await signMessageAsync({
        message: timestamp.toString(),
      });
      const result = await getComputeResult(
        job.peerId,
        job.jobId,
        archive?.index,
        signature,
        timestamp,
        account.address
      );
      if (result instanceof Uint8Array) {
        const blob = new Blob([result as any], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `job-${job.jobId}-result.tar`;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Failed to download result:', e);
    } finally {
      setIsDownloading(false);
    }
  };
  return (
    <Tooltip title={isDownloading ? 'Downloading...' : 'Download result'}>
      <span>
        <IconButton onClick={handleDownload} disabled={!isReady || isDownloading} size="small" color="primary">
          <DownloadIcon />
        </IconButton>
      </span>
    </Tooltip>
  );
};
