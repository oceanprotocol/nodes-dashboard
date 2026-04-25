import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import CreateBucketModal from '@/components/node-storage/create-bucket-modal';
import EditBucketAccessModal from '@/components/node-storage/edit-bucket-access-modal';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node } from '@/types';
import CachedIcon from '@mui/icons-material/Cached';
import EditIcon from '@mui/icons-material/Edit';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SearchIcon from '@mui/icons-material/Search';
import { PersistentStorageBucket } from '@oceanprotocol/lib';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './my-buckets.module.css';

type MyBucketsProps = {
  node: Node;
};

const MyBuckets: React.FC<MyBucketsProps> = ({ node }) => {
  const router = useRouter();

  const { account } = useOceanAccount();

  const { buckets, fetchingBuckets, fetchBuckets } = useNodeStorage();

  const nodeId = node.id ?? node.nodeId ?? '';
  const nodeUri = node.currentAddrs?.length ? node.currentAddrs : nodeId;

  const [createOpen, setCreateOpen] = useState(false);
  const [editBucket, setEditBucket] = useState<PersistentStorageBucket | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loading = fetchingBuckets[nodeId] ?? false;
  const alreadyLoaded = nodeId in buckets;

  const loadBuckets = useCallback(async () => {
    if (!account.address || !nodeId) {
      return;
    }
    try {
      await fetchBuckets({ nodeId, nodeUri });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load buckets');
    }
  }, [account.address, nodeId, nodeUri, fetchBuckets]);

  useEffect(() => {
    if (!alreadyLoaded) {
      loadBuckets();
    }
  }, [alreadyLoaded, loadBuckets]);

  const filteredBuckets = useMemo(() => {
    const myBuckets = buckets[nodeId] ?? [];
    const term = searchTerm.trim();
    if (!term) {
      return myBuckets;
    }
    return myBuckets.filter((b) => b.bucketId.toLowerCase().includes(term.toLowerCase()));
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
      <Table<PersistentStorageBucket>
        autoHeight
        actionsColumn={(params) => (
          <>
            <Button
              color="accent1"
              contentBefore={<EditIcon />}
              onClick={(e) => {
                e.stopPropagation();
                setEditBucket(params.row);
              }}
              size="sm"
              variant="transparent"
            >
              Access
            </Button>
            <Button
              color="accent1"
              contentBefore={<FolderOpenIcon />}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/nodes/${nodeId}/storage/${params.row.bucketId}/files`);
              }}
              size="sm"
              variant="transparent"
            >
              Files
            </Button>
          </>
        )}
        loading={loading}
        paginationType="none"
        tableType={TableTypeEnum.NODE_STORAGE_MY_BUCKETS}
        data={filteredBuckets}
        getRowId={(row) => row.bucketId}
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
      <CreateBucketModal isOpen={createOpen} node={node} onClose={() => setCreateOpen(false)} onSave={loadBuckets} />
      {editBucket && account?.address && (
        <EditBucketAccessModal
          bucket={editBucket}
          currentAccount={account.address}
          isOpen
          node={node}
          onClose={() => setEditBucket(null)}
        />
      )}
    </Card>
  );
};

export default MyBuckets;
