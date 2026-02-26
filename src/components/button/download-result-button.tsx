import Button from '@/components/button/button';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeJob } from '@/types/jobs';
import { generateAuthToken } from '@/utils/generateAuthToken';
import DownloadIcon from '@mui/icons-material/Download';
import { useState } from 'react';
import { toast } from 'react-toastify';

interface DownloadResultButtonProps {
  job: ComputeJob;
}

export const DownloadResultButton = ({ job }: DownloadResultButtonProps) => {
  const { account, signMessage } = useOceanAccount();
  const { getComputeResult, getComputeJobStatus, isReady } = useP2P();

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!isReady || isDownloading || !account?.address) return;

    try {
      const jobId = (job.environment ?? job.environmentId).split('-')[0] + '-' + job.jobId;
      setIsDownloading(true);
      const jobStatus = await getComputeJobStatus(job.peerId, jobId, account.address);
      const archive = jobStatus?.[0]?.results?.find((result: any) => result.filename.includes('.tar'));

      const authToken = await generateAuthToken(job.peerId, account.address, signMessage);

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
      Results
    </Button>
  );
};
