'use client';

import Button from '@/components/button/button';
import DownloadServiceResultButton from '@/components/inference/download-service-result-button';
import { NodeUri } from '@/contexts/P2PContext';
import { getOutputArchives, getOutputBucketId } from '@/types/service-outputs';
import { formatBytes, formatDateTime } from '@/utils/formatters';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { ServiceJob, ServiceStatusNumber } from '@oceanprotocol/lib';
import { useRouter } from 'next/router';
import styles from './service-results-panel.module.css';

type ServiceResultsPanelProps = {
  isExpired: boolean;
  job: ServiceJob;
  nodePeerId: string;
  nodeUri: NodeUri;
};

/** Results live in an output bucket, or in node-managed ZIP archives after teardown.
 * Successful restarts carry the output folder forward; failed copies can create an archive.
 */
const ServiceResultsPanel: React.FC<ServiceResultsPanelProps> = ({ isExpired, job, nodePeerId, nodeUri }) => {
  const router = useRouter();
  const bucketId = getOutputBucketId(job);

  if (bucketId) {
    return (
      <div className={styles.panel}>
        <div className={styles.head}>
          <FolderOutlinedIcon className={styles.icon} aria-hidden="true" />
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

  const archives = getOutputArchives(job);
  // The node zips the live folder only while the container exists: Running, or Error before teardown.
  // A failed restart leaves Error with no container, which the node refuses (409).
  const canDownloadLive =
    !isExpired &&
    !!job.containerId &&
    (job.status === ServiceStatusNumber.Running || job.status === ServiceStatusNumber.Error);

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.rowInfo}>
          <strong>Service outputs</strong>
          <span className="textSecondary">Download current results or revisit a saved archive.</span>
        </div>
        <span className={styles.badge}>ZIP archives</span>
      </div>
      <p className={styles.notice}>
        Outputs are archived when the service stops or its session ends. Download files you want to keep before the
        node’s storage period ends.
      </p>

      {canDownloadLive ? (
        <div className={`${styles.row} ${styles.liveRow}`}>
          <FolderZipOutlinedIcon className={styles.icon} aria-hidden="true" />
          <div className={styles.rowInfo}>
            <strong>
              Current outputs <span className={styles.badge}>Live snapshot</span>
            </strong>
            <span className="textSecondary">A zip of what the running service has written so far</span>
          </div>
          <DownloadServiceResultButton
            filesize={0}
            index="live"
            label="Download ZIP"
            nodePeerId={nodePeerId}
            nodeUri={nodeUri}
            serviceId={job.serviceId}
            suggestedName={`${job.serviceId}-outputs-live.zip`}
          />
        </div>
      ) : null}

      {archives.length > 0 ? (
        <div className={styles.sectionLabel}>
          Saved archives <span>{archives.length}</span>
        </div>
      ) : null}
      {archives.map((archive, position) => (
        <div className={styles.row} key={archive.index}>
          <FolderZipOutlinedIcon className={styles.icon} aria-hidden="true" />
          <div className={styles.rowInfo}>
            <strong>
              Archive {archive.index + 1} {position === 0 ? <span className={styles.badge}>Latest</span> : null}
            </strong>
            <span className={styles.filename}>{archive.filename}</span>
            <span className="textSecondary">
              {formatDateTime(archive.createdAt / 1000)} · {formatBytes(archive.filesize)}
            </span>
          </div>
          <DownloadServiceResultButton
            filesize={archive.filesize}
            index={archive.index}
            label="Download ZIP"
            nodePeerId={nodePeerId}
            nodeUri={nodeUri}
            serviceId={job.serviceId}
            suggestedName={`${job.serviceId}-${archive.filename}`}
          />
        </div>
      ))}

      {archives.length === 0 && !canDownloadLive ? (
        <div className={styles.empty}>
          <Inventory2OutlinedIcon aria-hidden="true" />
          <strong>No saved results{isExpired ? '' : ' yet'}</strong>
          <span className="textSecondary">
            {isExpired
              ? 'The service wrote no outputs, or the node’s storage period has passed.'
              : 'Archives will appear here after the service writes outputs and stops.'}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default ServiceResultsPanel;
