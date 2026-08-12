import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import BucketsTable from '@/components/node-storage/buckets-table';
import CreateBucketModal from '@/components/node-storage/create-bucket-modal';
import { useP2P } from '@/contexts/P2PContext';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node } from '@/types';
import { formatError } from '@/utils/formatters';
import { toStorageNode } from '@/utils/node-storage';
import CachedIcon from '@mui/icons-material/Cached';
import SearchIcon from '@mui/icons-material/Search';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './my-buckets.module.css';

type MyBucketsProps = {
  node: Node;
};

const MyBuckets: React.FC<MyBucketsProps> = ({ node }) => {
  const { account } = useOceanAccount();

  const { buckets, fetchingBuckets, fetchBuckets } = useNodeStorage();
  // Bucket calls go over the P2P node, which sets itself up after mount.
  const { isReady: isP2PReady } = useP2P();

  const storageNode = useMemo(() => toStorageNode(node), [node]);
  const { nodeId, nodeUri } = storageNode;

  const [alreadyLoaded, setAlreadyLoaded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loading = fetchingBuckets[nodeId] ?? false;

  const loadBuckets = useCallback(async () => {
    try {
      await fetchBuckets({ nodeId, nodeUri });
    } catch (e: any) {
      toast.error(formatError({ error: e, fallback: 'The buckets could not be loaded.' }));
    }
  }, [nodeId, nodeUri, fetchBuckets]);

  useEffect(() => {
    // Loading before the P2P node is up fails with "Node not ready" and nothing retries it, so wait
    // for it — isP2PReady is a dependency, so this runs again once the node comes up.
    if (!account.address || !nodeId || !isP2PReady) {
      return;
    }
    if (!(nodeId in buckets) && !alreadyLoaded) {
      setAlreadyLoaded(true);
      loadBuckets();
    }
  }, [nodeId, buckets, isP2PReady, loadBuckets, alreadyLoaded, account.address]);

  const filteredBuckets = useMemo(() => {
    const myBuckets = buckets[nodeId] ?? [];
    const term = searchTerm.trim();
    if (!term) {
      return myBuckets;
    }
    const lowerTerm = term.toLowerCase();
    return myBuckets.filter(
      (b) => b.bucketId.toLowerCase().includes(lowerTerm) || (b.label ?? '').toLowerCase().includes(lowerTerm)
    );
  }, [buckets, nodeId, searchTerm]);

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" shadow="black" variant="glass-shaded">
      <div className={styles.header}>
        <h3>My Buckets</h3>
        <Button color="accent1" size="md" variant="filled" onClick={() => setCreateOpen(true)}>
          Create bucket
        </Button>
      </div>
      <Input
        className="alignSelfStart"
        startAdornment={<SearchIcon className="textAccent1" />}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search..."
        type="text"
        size="sm"
        value={searchTerm}
      />
      <BucketsTable
        backHref={`/nodes/${nodeId}/storage`}
        buckets={filteredBuckets}
        loading={loading}
        node={storageNode}
      />
      <Button
        className="alignSelfEnd"
        color="accent1"
        contentBefore={<CachedIcon />}
        onClick={loadBuckets}
        size="sm"
        variant="transparent"
      >
        Refresh
      </Button>
      <CreateBucketModal
        isOpen={createOpen}
        node={storageNode}
        onClose={() => setCreateOpen(false)}
        onSave={loadBuckets}
      />
    </Card>
  );
};

export default MyBuckets;
