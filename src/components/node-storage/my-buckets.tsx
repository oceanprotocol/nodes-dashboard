import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import CreateBucketModal from '@/components/node-storage/create-bucket-modal';
import EditBucketAccessModal from '@/components/node-storage/edit-bucket-access-modal';
import EditBucketNameModal from '@/components/node-storage/edit-bucket-name-modal';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node } from '@/types';
import { formatError } from '@/utils/formatters';
import CachedIcon from '@mui/icons-material/Cached';
import EditIcon from '@mui/icons-material/Edit';
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

  const [alreadyLoaded, setAlreadyLoaded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBucket, setEditBucket] = useState<PersistentStorageBucket | null>(null);
  const [renameBucket, setRenameBucket] = useState<PersistentStorageBucket | null>(null);
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
    if (!account.address || !nodeId) {
      return;
    }
    if (!(nodeId in buckets) && !alreadyLoaded) {
      setAlreadyLoaded(true);
      loadBuckets();
    }
  }, [nodeId, buckets, loadBuckets, alreadyLoaded, account.address]);

  const filteredBuckets = useMemo(() => {
    const myBuckets = buckets[nodeId] ?? [];
    const term = searchTerm.trim();
    if (!term) {
      return myBuckets;
    }
    const lowerTerm = term.toLowerCase();
    return myBuckets.filter(
      (b) =>
        b.bucketId.toLowerCase().includes(lowerTerm) || (b.label ?? '').toLowerCase().includes(lowerTerm)
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
      <Table<PersistentStorageBucket>
        autoHeight
        actionsColumn={(params) => (
          <>
            <Button
              color="accent1"
              contentBefore={<EditIcon />}
              onClick={(e) => {
                e.stopPropagation();
                setRenameBucket(params.row);
              }}
              size="sm"
              variant="transparent"
            >
              Name
            </Button>
            {params.row.accessLists.length > 0 ? (
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
            ) : null}
          </>
        )}
        loading={loading}
        onRowClick={({ row }) => router.push(`/nodes/${nodeId}/storage/${row.bucketId}/files`)}
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
      {renameBucket && (
        <EditBucketNameModal bucket={renameBucket} isOpen node={node} onClose={() => setRenameBucket(null)} />
      )}
    </Card>
  );
};

export default MyBuckets;
