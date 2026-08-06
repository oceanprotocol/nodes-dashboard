import Button from '@/components/button/button';
import Select from '@/components/input/select';
import CreateBucketModal from '@/components/node-storage/create-bucket-modal';
import { useLoadNodeBuckets } from '@/contexts/node-storage-context';
import { toNodeUri } from '@/services/inference-launch';
import { EnvNodeInfo } from '@/types/environments';
import AddIcon from '@mui/icons-material/Add';
import { useEffect, useMemo, useState } from 'react';
import styles from './template-bucket-picker.module.css';

type TemplateBucketPickerProps = {
  /** The environment's own node — the bucket must live where the service will run, not the app default. */
  nodeInfo: EnvNodeInfo;
  selectedBucketId: string | null;
  onSelect: (bucketId: string | null) => void;
};

/**
 * Persistent-storage bucket picker for the template config step — the bucket this app mounts to cache
 * its model weights across relaunches. Only ever offers buckets `fetchBuckets` actually returned for
 * this node, never a free-text id: the node-side mount runs after the escrow claim, so an id the node
 * doesn't recognize would cost the user their payment rather than just fail to load.
 */
const TemplateBucketPicker: React.FC<TemplateBucketPickerProps> = ({ nodeInfo, selectedBucketId, onSelect }) => {
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
        <h4>Persistent storage</h4>
        <div className="textSecondary">Caches this app&apos;s model weights so relaunches skip the download.</div>
      </div>
      <div className={styles.row}>
        <Select
          className={styles.select}
          label="Bucket"
          onChange={(e) => onSelect((e.target.value as string) || null)}
          options={[
            { value: '', label: 'No bucket' },
            ...nodeBuckets.map((b) => ({ value: b.bucketId, label: b.label || b.bucketId })),
          ]}
          placeholder={loading ? 'Loading buckets…' : 'No bucket'}
          size="md"
          value={selectedBucketId ?? ''}
        />
        <Button
          color="accent1"
          contentBefore={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          size="md"
          type="button"
          variant="outlined"
        >
          Create bucket
        </Button>
      </div>
      {!selectedBucketId && (
        <div className="textWarning">
          Without a bucket, this app re-downloads 38 GB of model weights on every launch, inside your paid session.
        </div>
      )}
      <CreateBucketModal
        isOpen={createOpen}
        nodeId={nodeId}
        nodeUri={nodeUri}
        friendlyName={nodeInfo.friendlyName}
        onClose={() => setCreateOpen(false)}
        // createBucket already refetches internally — no need to reload here too. Auto-select the new
        // bucket instead: it's the only reason the user opened this modal.
        onSave={(bucket) => onSelect(bucket.bucketId)}
      />
    </div>
  );
};

export default TemplateBucketPicker;
