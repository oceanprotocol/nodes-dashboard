'use client';

import Button from '@/components/button/button';
import DownloadServiceResultButton from '@/components/inference/download-service-result-button';
import { NodeUri } from '@/contexts/P2PContext';
import { isServiceResultDownloadSupported } from '@/services/nodeService';
import { getOutputArchives, getOutputBucketId } from '@/types/service-outputs';
import { formatBytes, formatDateTime } from '@/utils/formatters';
import { ServiceJob, ServiceStatusNumber } from '@oceanprotocol/lib';
import { useRouter } from 'next/router';
import styles from './service-results-panel.module.css';

type ServiceResultsPanelProps = {
  isExpired: boolean;
  job: ServiceJob;
  nodePeerId: string;
  nodeUri: NodeUri;
};

/**
 * What the service left in /data/outputs. With an output bucket the files are in the bucket, so this
 * links there. Without one, the node zips the folder every time a container goes away (stop, session
 * end, restart) and keeps those zips for the environment's storage period; while the container runs,
 * its current outputs can be zipped live — a service can run for weeks, its owner shouldn't have to
 * stop it to get results.
 */
const ServiceResultsPanel: React.FC<ServiceResultsPanelProps> = ({ isExpired, job, nodePeerId, nodeUri }) => {
  const router = useRouter();
  const bucketId = getOutputBucketId(job);

  if (bucketId) {
    return (
      <div className={styles.panel}>
        <div className={styles.head}>
          <div className="textSecondary">
            This service saves its results to bucket <strong>{bucketId}</strong>.
          </div>
          <Button
            color="accent1"
            href={`/nodes/${nodePeerId}/storage/${bucketId}/files?from=${encodeURIComponent(router.asPath)}`}
            size="sm"
            variant="transparent"
          >
            Open bucket
          </Button>
        </div>
      </div>
    );
  }

  if (!isServiceResultDownloadSupported()) {
    return (
      <div className="textSecondary">Downloading results isn&apos;t available in this version of the app yet.</div>
    );
  }

  const archives = getOutputArchives(job);
  // The node zips the live folder only while the container exists: Running, or Error before teardown.
  const canDownloadLive =
    !isExpired && (job.status === ServiceStatusNumber.Running || job.status === ServiceStatusNumber.Error);

  return (
    <div className={styles.panel}>
      <div className="textSecondary">
        Files the service writes to <code>/data/outputs</code> are saved as a zip each time it stops, restarts or its
        session ends, and kept for a limited time after the session ends.
      </div>

      {canDownloadLive ? (
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <strong>Current outputs</strong>
            <span className="textSecondary">A zip of what the running service has written so far</span>
          </div>
          <DownloadServiceResultButton
            filesize={0}
            index="live"
            label="Download"
            nodePeerId={nodePeerId}
            nodeUri={nodeUri}
            serviceId={job.serviceId}
            suggestedName={`${job.serviceId}-outputs-live.zip`}
          />
        </div>
      ) : null}

      {archives.map((archive) => (
        <div className={styles.row} key={archive.index}>
          <div className={styles.rowInfo}>
            <strong>{archive.filename}</strong>
            <span className="textSecondary">
              {formatDateTime(archive.createdAt / 1000)} · {formatBytes(archive.filesize)}
            </span>
          </div>
          <DownloadServiceResultButton
            filesize={archive.filesize}
            index={archive.index}
            label="Download"
            nodePeerId={nodePeerId}
            nodeUri={nodeUri}
            serviceId={job.serviceId}
            suggestedName={`${job.serviceId}-${archive.filename}`}
          />
        </div>
      ))}

      {archives.length === 0 && !canDownloadLive ? (
        <div className="textSecondary">
          {isExpired
            ? 'No saved results. Either the service wrote nothing to /data/outputs, or the storage period has passed.'
            : 'No saved results yet.'}
        </div>
      ) : null}
    </div>
  );
};

export default ServiceResultsPanel;
