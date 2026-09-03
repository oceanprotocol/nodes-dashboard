import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import BucketsTable from '@/components/node-storage/buckets-table';
import CreateBucketModal from '@/components/node-storage/create-bucket-modal';
import { useLoadNodeBuckets } from '@/contexts/node-storage-context';
import { Node } from '@/types';
import { toStorageNode } from '@/utils/node-storage';
import CachedIcon from '@mui/icons-material/Cached';
import SearchIcon from '@mui/icons-material/Search';
import { useMemo, useState } from 'react';
import styles from './my-buckets.module.css';

type MyBucketsProps = {
  node: Node;
};

const MyBuckets: React.FC<MyBucketsProps> = ({ node }) => {
  const storageNode = useMemo(() => toStorageNode(node), [node]);
  const { nodeId, nodeUri } = storageNode;

  const { buckets, loading, loadBuckets } = useLoadNodeBuckets({ nodeId, nodeUri });

  const [createOpen, setCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBuckets = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) {
      return buckets;
    }
    const lowerTerm = term.toLowerCase();
    return buckets.filter(
      (b) => b.bucketId.toLowerCase().includes(lowerTerm) || (b.label ?? '').toLowerCase().includes(lowerTerm)
    );
  }, [buckets, searchTerm]);

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
