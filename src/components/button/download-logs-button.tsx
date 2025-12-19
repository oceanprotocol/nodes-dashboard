import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeJob } from '@/types/jobs';
import { generateAuthTokenWithSmartAccount } from '@/utils/generateAuthToken';
import { useSignMessage, useSmartAccountClient } from '@account-kit/react';
import DownloadIcon from '@mui/icons-material/Download';
import { IconButton, Tooltip } from '@mui/material';
import { useState } from 'react';

interface DownloadLogsButtonProps {
  job: ComputeJob;
}

export const DownloadLogsButton = ({ job }: DownloadLogsButtonProps) => {
  const { getComputeLogs, isReady } = useP2P();
  const [isDownloading, setIsDownloading] = useState(false);
  const { client } = useSmartAccountClient({ type: 'LightAccount' });
  const { signMessageAsync } = useSignMessage({
    client,
  });
  const { account } = useOceanAccount();

  const handleDownload = async () => {
    if (!isReady || isDownloading || !account?.address) return;

    try {
      //const authToken = await generateAuthTokenWithSmartAccount(job.peerId, account.address, signMessageAsync)
      const authToken = await generateAuthTokenWithSmartAccount('16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi', account.address, signMessageAsync)
      console.log('authToken', authToken)
      setIsDownloading(true);
      const result = await getComputeLogs('16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi', 'b1a00b46b0ce991d0dcaff8097159099f85ac43ced16a79a548ab1e2708d2ce0', authToken);

      console.log('Download logs result type:', typeof result);
      console.log('Is Uint8Array:', result instanceof Uint8Array);
      console.log('Result:', result);
      console.log('Result length:', result?.length);
      console.log('Result byteLength:', result?.byteLength);

      if (result instanceof Uint8Array) {
        console.log('Creating blob with size:', result.byteLength);
        const blob = new Blob([result as any], { type: 'application/octet-stream' });
        console.log('Blob size:', blob.size);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `job-${job.jobId}-logs.tar`;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        console.error('Result is not a Uint8Array. Type:', typeof result, 'Value:', result);
      }
    } catch (e) {
      console.error('Failed to download logs:', e);
    } finally {
      setIsDownloading(false);
    }
  };
  return (
    <Tooltip title={isDownloading ? 'Downloading...' : 'Download logs'}>
      <span>
        <IconButton onClick={handleDownload} disabled={!isReady || isDownloading} size="small" color="primary">
          <DownloadIcon />
        </IconButton>
      </span>
    </Tooltip>
  );
};
