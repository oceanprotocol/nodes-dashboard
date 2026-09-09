'use client';

import Button from '@/components/button/button';
import EditBucketAccessModal from '@/components/node-storage/edit-bucket-access-modal';
import EditBucketNameModal from '@/components/node-storage/edit-bucket-name-modal';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { StorageNode } from '@/types/node-storage';
import EditIcon from '@mui/icons-material/Edit';
import { PersistentStorageBucket } from '@oceanprotocol/lib';
import { useRouter } from 'next/router';
import { useState } from 'react';

type BucketsTableProps = {
  /** Where the bucket's files page sends the user back to — the page this table is embedded in. */
  backHref: string;
  buckets: PersistentStorageBucket[];
  initialDensity?: 'compact' | 'standard' | 'comfortable';
  loading?: boolean;
  node: StorageNode;
};

/**
 * The bucket list for one node, with its rename and access-list editors. Shared by the per-node
 * storage page and the account-wide storage view, which stack one of these per node.
 */
const BucketsTable: React.FC<BucketsTableProps> = ({ backHref, buckets, initialDensity, loading, node }) => {
  const router = useRouter();

  const { account } = useOceanAccount();

  const [editBucket, setEditBucket] = useState<PersistentStorageBucket | null>(null);
  const [renameBucket, setRenameBucket] = useState<PersistentStorageBucket | null>(null);

  return (
    <>
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
        initialDensity={initialDensity}
        loading={loading}
        onRowClick={({ row }) =>
          router.push({
            pathname: `/nodes/${node.nodeId}/storage/${row.bucketId}/files`,
            query: { from: backHref },
          })
        }
        paginationType="none"
        tableType={TableTypeEnum.NODE_STORAGE_MY_BUCKETS}
        data={buckets}
        getRowId={(row) => row.bucketId}
      />
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
    </>
  );
};

export default BucketsTable;
