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

    job = {
      owner: '0xD8127C2896F6D6aB77aa7F89fa4eA4a45a802EB5',
      did: null,
      jobId: 'b76a5000261497a7082e4206209c61f7ffe683b2547b92104dabce7513fd824a',
      dateCreated: '1767600980.248',
      dateFinished: '1767600992.647',
      status: 70,
      statusText: 'Job finished',
      results: [
        {
          filename: 'image.log',
          filesize: 639,
          type: 'imageLog',
          index: 0,
        },
        {
          filename: 'configuration.log',
          filesize: 324,
          type: 'configurationLog',
          index: 1,
        },
        {
          filename: 'algorithm.log',
          filesize: 73,
          type: 'algorithmLog',
          index: 2,
        },
        {
          filename: 'outputs.tar',
          filesize: 2560,
          type: 'output',
          index: 3,
        },
      ],
      inputDID: null,
      algoDID: null,
      agreementId: null,
      environment:
        '0x14fc9dabe8b4a19310a3a0bf976fb14ab1a6c1f77f5ac74d35211f969c5180eb-0x12dcecf35edca64893b4e7d5fe81b2c22e4d6e38366ec4a57348037cc8c62123',
      stopRequested: false,
      resources: [
        {
          id: 'cpu',
          amount: 1,
        },
        {
          id: 'ram',
          amount: 1,
        },
        {
          id: 'disk',
          amount: 1,
        },
        {
          id: 'myGPU',
          amount: 1,
        },
      ],
      isFree: true,
      algoStartTimestamp: '1767600985.589',
      algoStopTimestamp: '1767600990.613',
      terminationDetails: {
        exitCode: 0,
        OOMKilled: false,
      },
      payment: null,
      algoDuration: 5.023999929428101,
      queueMaxWaitTime: 0,
      maxJobDuration: 7200,
    } as any;

    try {
      const jobId = job.environment.split('-')[0] + '-' + job.jobId;
      //const authToken = await generateAuthTokenWithSmartAccount(job.peerId, account.address, signMessageAsync)
      const authToken = await generateAuthTokenWithSmartAccount(
        '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi',
        account.address,
        signMessageAsync
      );

      const logFiles = job.results.filter((result: any) => result.filename.includes('.log'));
      //const logPromises = logIndexes.map((index: any) => getComputeResult(job.peerId, job.jobId, index, authToken, account.address));
      const logPromises = logFiles.map((logFile: any) =>
        getComputeResult(
          '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi',
          jobId,
          logFile.index,
          authToken,
          account.address
        )
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
      link.download = `logs.zip`;

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
