import Button from '@/components/button/button';
import Modal from '@/components/modal/modal';
import CreateBucketModal from '@/components/node-storage/create-bucket-modal';
import { useLoadNodeBuckets } from '@/contexts/node-storage-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { toNodeUri } from '@/services/inference-launch';
import { EnvNodeInfo } from '@/types/environments';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { useEffect, useMemo, useState } from 'react';
import styles from './template-bucket-picker.module.css';

type TemplateBucketPickerProps = {
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

/** Select only buckets returned by the launch node, since mounting happens after payment. */
const TemplateBucketPicker: React.FC<TemplateBucketPickerProps> = ({
  nodeInfo,
  storageExpiry,
  selectedBucketId,
  onSelect,
}) => {
  const retention = formatStorageRetention(storageExpiry);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const { account } = useOceanAccount();
  const nodeId = nodeInfo.id;
  const nodeUri = useMemo(() => toNodeUri(nodeInfo), [nodeInfo]);
  const { buckets: nodeBuckets, loaded, loading, loadBuckets } = useLoadNodeBuckets({ nodeId, nodeUri });

  useEffect(() => {
    if (loaded && selectedBucketId && !nodeBuckets.some((bucket) => bucket.bucketId === selectedBucketId)) {
      onSelect(null);
      setFeedback('Previous bucket is unavailable. Automatic storage selected.');
    }
  }, [loaded, nodeBuckets, selectedBucketId, onSelect]);

  const selectedBucket = nodeBuckets.find((bucket) => bucket.bucketId === selectedBucketId);
  const destination = selectedBucketId ? selectedBucket?.label || selectedBucketId : 'Automatic storage';
  const query = search.trim().toLowerCase();
  const matchingBuckets = nodeBuckets.filter((bucket) =>
    `${bucket.label ?? ''} ${bucket.bucketId}`.toLowerCase().includes(query)
  );
  const automaticDetails =
    storageExpiry === 0
      ? 'Download results before the session ends.'
      : retention
        ? `Kept for ${retention} after the session ends.`
        : 'Kept until the node’s storage period ends.';

  const chooseStorage = (bucketId: string | null) => {
    setFeedback(bucketId !== selectedBucketId ? 'Storage updated' : '');
    onSelect(bucketId);
    setPickerOpen(false);
    setCreateOpen(false);
  };

  return (
    <section className={styles.section} aria-label="Result storage">
      <div className={styles.header}>
        <h4>Save results to</h4>
        <Button
          color="accent1"
          onClick={() => {
            setSearch('');
            setFeedback('');
            setPickerOpen(true);
          }}
          size="sm"
          type="button"
          variant="transparent"
        >
          Change
        </Button>
      </div>
      <div className={styles.destination}>
        <span className={styles.icon}>
          <FolderOutlinedIcon aria-hidden="true" />
        </span>
        <div className={styles.summary}>
          <strong>{destination}</strong>
          <p>
            {selectedBucketId ? 'Results reusable across runs. Your bucket’s storage terms apply.' : automaticDetails}
          </p>
          {!selectedBucketId && (
            <p className={styles.hint}>
              Storage is created automatically. Download files you want to keep before they expire.
            </p>
          )}
        </div>
      </div>
      <div className={styles.feedback} role="status" aria-live="polite" aria-atomic="true">
        {feedback && (
          <>
            <CheckCircleOutlineIcon aria-hidden="true" />
            <span>{feedback}</span>
          </>
        )}
      </div>
      <Modal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} title="Change storage" width="sm" fullWidth>
        <div className={styles.dialog}>
          <button
            className={`${styles.choice} ${!selectedBucketId ? styles.selected : ''}`}
            onClick={() => chooseStorage(null)}
            type="button"
            aria-label="Use automatic storage"
          >
            <FolderOutlinedIcon aria-hidden="true" />
            <span className={styles.choiceText}>
              <strong>
                Automatic storage <span className={styles.badge}>Default</span>
              </strong>
              <span>{automaticDetails}</span>
            </span>
            {!selectedBucketId && <CheckCircleOutlineIcon className={styles.check} aria-label="Selected" />}
          </button>
          <div className={styles.bucketHeader}>
            <strong>Custom buckets</strong>
            <Button
              color="accent1"
              contentBefore={<AddIcon />}
              size="xs"
              type="button"
              variant="transparent"
              onClick={() => {
                setPickerOpen(false);
                setCreateOpen(true);
              }}
            >
              Create bucket
            </Button>
          </div>
          <p className={styles.description}>Reuse saved results as input on another run.</p>
          <label className={styles.search}>
            <SearchIcon aria-hidden="true" />
            <input
              aria-label="Search buckets"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
              placeholder="Search by name or ID"
              type="search"
              value={search}
            />
          </label>
          <div className={styles.bucketList} aria-label="Available buckets" aria-busy={loading}>
            {matchingBuckets.map((bucket) => (
              <button
                className={`${styles.choice} ${selectedBucketId === bucket.bucketId ? styles.selected : ''}`}
                key={bucket.bucketId}
                onClick={() => chooseStorage(bucket.bucketId)}
                type="button"
              >
                <FolderOutlinedIcon aria-hidden="true" />
                <span className={styles.choiceText}>
                  <strong>{bucket.label || bucket.bucketId}</strong>
                  {bucket.label && <span className={styles.bucketId}>{bucket.bucketId}</span>}
                </span>
                {selectedBucketId === bucket.bucketId && (
                  <CheckCircleOutlineIcon className={styles.check} aria-label="Selected" />
                )}
              </button>
            ))}
            {!matchingBuckets.length && (
              <p className={styles.empty} role="status">
                {loading
                  ? 'Loading buckets…'
                  : !account.address
                    ? 'Log in to view your buckets.'
                    : query
                      ? 'No buckets match your search.'
                      : 'No buckets available on this node.'}
              </p>
            )}
          </div>
          {account.address && !loading && !nodeBuckets.length && (
            <Button color="accent1" onClick={loadBuckets} size="xs" type="button" variant="transparent">
              Reload buckets
            </Button>
          )}
        </div>
      </Modal>
      <CreateBucketModal
        isOpen={createOpen}
        node={{ friendlyName: nodeInfo.friendlyName, nodeId, nodeUri }}
        onClose={() => {
          setCreateOpen(false);
          setPickerOpen(true);
        }}
        onSave={(_node, bucket) => chooseStorage(bucket.bucketId)}
      />
    </section>
  );
};

export default TemplateBucketPicker;
