import Button from '@/components/button/button';
import Select from '@/components/input/select';
import CreateBucketModal from '@/components/node-storage/create-bucket-modal';
import { useLoadNodeBuckets } from '@/contexts/node-storage-context';
import { toNodeUri } from '@/services/inference-launch';
import { EnvNodeInfo } from '@/types/environments';
import { formatDuration } from '@/utils/formatters';
import AddIcon from '@mui/icons-material/Add';
import { useEffect, useMemo, useState } from 'react';
import styles from './template-bucket-picker.module.css';

type TemplateBucketPickerProps = {
  /** The environment's own node — the bucket must live where the service will run, not the app default. */
  nodeInfo: EnvNodeInfo;
  storageExpiry?: number;
  selectedBucketId: string | null;
  onSelect: (bucketId: string | null) => void;
};

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
  const retention =
    storageExpiry != null && Number.isFinite(storageExpiry) && storageExpiry >= 0
      ? storageExpiry >= 86400 && storageExpiry % 86400 === 0
        ? `${storageExpiry / 86400} ${storageExpiry === 86400 ? 'day' : 'days'}`
        : formatDuration(storageExpiry)
      : null;
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
      <div>
        <h4>Result storage</h4>
        <div className="textSecondary">
          The node automatically creates storage for this run&apos;s results. Without a custom bucket, results are
          archived when the service stops or its session ends
          {retention
            ? ` and kept for ${retention} after the session ends.`
            : ' and kept until the node’s storage period ends.'}{' '}
          Download results you want to keep before they expire.
        </div>
        <div className="textSecondary">
          Optionally create or select a custom bucket to store results and reuse them as input on a different run.
          Custom buckets follow their own storage terms.
        </div>
      </div>
      <Select
        className={styles.select}
        label="Result bucket (optional)"
        onChange={(e) => onSelect((e.target.value as string) || null)}
        options={[
          { value: '', label: 'Automatic result storage' },
          ...nodeBuckets.map((b) => ({ value: b.bucketId, label: b.label || b.bucketId })),
        ]}
        placeholder={loading ? 'Loading buckets…' : 'Automatic result storage'}
        size="md"
        topRight={
          <Button
            color="accent1"
            contentBefore={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            size="xs"
            type="button"
            variant="transparent"
          >
            Create bucket
          </Button>
        }
        value={selectedBucketId ?? ''}
      />
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
