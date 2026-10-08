import Button from '@/components/button/button';
import Select from '@/components/input/select';
import CreateBucketModal from '@/components/node-storage/create-bucket-modal';
import { useLoadNodeBuckets } from '@/contexts/node-storage-context';
import { toNodeUri } from '@/services/inference-launch';
import { EnvNodeInfo } from '@/types/environments';
import AddIcon from '@mui/icons-material/Add';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { useEffect, useMemo, useState } from 'react';
import styles from './template-bucket-picker.module.css';

type TemplateBucketPickerProps = {
  /** The environment's own node — the bucket must live where the service will run, not the app default. */
  nodeInfo: EnvNodeInfo;
  storageExpiry?: number;
  selectedBucketId: string | null;
  onSelect: (bucketId: string | null) => void;
};

/** Human-readable retention, with sub-minute precision omitted for longer storage periods. */
function formatStorageRetention(seconds: number | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds === 0) return 'No retention';
  if (seconds < 60) return 'Less than a minute';

  let remaining = Math.floor(seconds);
  const parts: string[] = [];
  for (const [unit, size] of [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ] as const) {
    const amount = Math.floor(remaining / size);
    remaining %= size;
    if (amount) parts.push(`${amount} ${unit}${amount === 1 ? '' : 's'}`);
    if (parts.length === 2) break;
  }
  return parts.join(' ');
}

/**
 * Optional output bucket for template results. Only offers buckets returned by this node:
 * the mount happens after the escrow claim, so an unknown bucket could cost the user their payment.
 */
const TemplateBucketPicker: React.FC<TemplateBucketPickerProps> = ({
  nodeInfo,
  storageExpiry,
  selectedBucketId,
  onSelect,
}) => {
  const retention = formatStorageRetention(storageExpiry);
  const [createOpen, setCreateOpen] = useState(false);

  const nodeId = nodeInfo.id;
  // Memoized — a fresh array every render would churn useLoadNodeBuckets' loadBuckets identity and
  // re-run its load effect.
  const nodeUri = useMemo(() => toNodeUri(nodeInfo), [nodeInfo]);
  const { buckets: nodeBuckets, loaded, loading } = useLoadNodeBuckets({ nodeId, nodeUri });

  // A selectedBucketId that isn't in THIS node's list belongs to a different node (stale from a
  // previously-picked template/node) — clear it once the list has landed, so the Select and the
  // launch payload agree instead of silently sending an id this node never offered.
  useEffect(() => {
    if (loaded && selectedBucketId && !nodeBuckets.some((b) => b.bucketId === selectedBucketId)) {
      onSelect(null);
    }
  }, [loaded, nodeBuckets, selectedBucketId, onSelect]);

  return (
    <div className={styles.section}>
      <h4>Result storage</h4>
      <div className={styles.automatic}>
        <div className={styles.summary}>
          <span className={styles.icon}>
            <FolderOutlinedIcon aria-hidden="true" />
          </span>
          <div>
            <div className={styles.titleRow}>
              <strong>{selectedBucketId ? 'Custom bucket storage' : 'Automatic storage'}</strong>
              <span className={styles.badge}>Selected</span>
            </div>
            <p className={styles.description}>
              {selectedBucketId
                ? 'Results are saved directly to your selected bucket.'
                : 'Your node saves this run’s results. No setup needed.'}
            </p>
          </div>
        </div>
        <div className={styles.retention}>
          <ScheduleOutlinedIcon aria-hidden="true" />
          <div>
            <strong>{selectedBucketId ? 'Bucket storage period' : (retention ?? 'Set by the node')}</strong>
            <span>
              {selectedBucketId
                ? 'Your bucket’s terms apply'
                : storageExpiry === 0
                  ? 'Download before the session ends'
                  : 'after the session ends'}
            </span>
          </div>
        </div>
      </div>
      <p className={styles.note}>
        {selectedBucketId
          ? 'Files in this bucket can be reused as input on another run.'
          : 'Results are archived when the service stops. Download files you want to keep before storage expires.'}
      </p>
      <div className={styles.custom}>
        <div className={styles.customHeader}>
          <div>
            <div className={styles.titleRow}>
              <strong>Reuse results across runs</strong>
              <span className={styles.optional}>Optional</span>
            </div>
            <p className={styles.description}>Save to a custom bucket to use your results as input on another run.</p>
          </div>
          <Button
            color="accent1"
            contentBefore={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            size="sm"
            type="button"
            variant="transparent"
          >
            Create bucket
          </Button>
        </div>
        <Select
          className={styles.select}
          label="Save results to"
          onChange={(e) => onSelect((e.target.value as string) || null)}
          options={[
            { value: '', label: 'Automatic storage (default)' },
            ...nodeBuckets.map((b) => ({ value: b.bucketId, label: b.label || b.bucketId })),
          ]}
          placeholder={loading ? 'Loading buckets…' : 'Automatic storage (default)'}
          size="md"
          value={selectedBucketId ?? ''}
        />
      </div>
      <CreateBucketModal
        isOpen={createOpen}
        node={{ friendlyName: nodeInfo.friendlyName, nodeId, nodeUri }}
        onClose={() => setCreateOpen(false)}
        // createBucket already refetches internally — no need to reload here too. Auto-select the new
        // bucket instead: it's the only reason the user opened this modal.
        onSave={(_node, bucket) => onSelect(bucket.bucketId)}
      />
    </div>
  );
};

export default TemplateBucketPicker;
