'use client';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import ConfirmModal from '@/components/modal/confirm-modal';
import EditBucketAccessModal from '@/components/node-storage/edit-bucket-access-modal';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node } from '@/types/nodes';
import { formatAccessLists, formatError } from '@/utils/formatters';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CachedIcon from '@mui/icons-material/Cached';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { PersistentStorageFileEntry } from '@oceanprotocol/lib';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './bucket-files.module.css';

type BucketFilesProps = {
  bucketId: string;
  node: Node;
};

const BucketFiles: React.FC<BucketFilesProps> = ({ bucketId, node }) => {
  const router = useRouter();

  const { account } = useOceanAccount();

  const { buckets, bucketFiles, fetchingFiles, uploadingFile, deletingFile, fetchBucketFiles, uploadFile, deleteFile } =
    useNodeStorage();

  const nodeId = node.id ?? node.nodeId ?? '';

  const bucket = useMemo(
    () => (buckets[nodeId] ?? []).find((b) => b.bucketId === bucketId) ?? null,
    [buckets, nodeId, bucketId]
  );

  const accessListLabels = useMemo(() => {
    if (!bucket || bucket.accessLists.length === 0) {
      return null;
    }
    const labels = formatAccessLists(bucket.accessLists, { shortenAddresses: bucket.accessLists.length > 1 });
    return labels.length > 0 ? labels : null;
  }, [bucket]);

  const [alreadyLoaded, setAlreadyLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editAccessOpen, setEditAccessOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const nodeUri = useMemo(
    () => (node.currentAddrs?.length ? node.currentAddrs : (node.id ?? node.nodeId ?? '')),
    [node]
  );

  const loading = fetchingFiles[bucketId] ?? false;
  const uploading = uploadingFile[bucketId] ?? false;

  const loadFiles = useCallback(async () => {
    try {
      await fetchBucketFiles({ bucketId, nodeId, nodeUri });
    } catch (e: any) {
      toast.error(formatError({ error: e, fallback: 'The files could not be loaded.' }));
    }
  }, [nodeId, bucketId, nodeUri, fetchBucketFiles]);

  useEffect(() => {
    if (!(bucketId in bucketFiles) && !alreadyLoaded) {
      setAlreadyLoaded(true);
      loadFiles();
    }
  }, [alreadyLoaded, bucketFiles, bucketId, loadFiles]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      return;
    }
    try {
      await uploadFile({ bucketId, file, nodeId, nodeUri });
      toast.success(`${file.name} uploaded`);
    } catch (err: any) {
      toast.error(formatError({ error: err, fallback: 'Your file could not be uploaded.' }));
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    const fileName = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteFile({ bucketId, fileName, nodeId, nodeUri });
      toast.success(`${fileName} deleted`);
    } catch (err: any) {
      toast.error(formatError({ error: err, fallback: 'Your file could not be deleted.' }));
    }
  };

  const filteredFiles = useMemo(() => {
    const files = bucketFiles[bucketId] ?? [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return files;
    }
    return files.filter((f) => f.name.toLowerCase().includes(term));
  }, [bucketFiles, bucketId, searchTerm]);

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" shadow="black" variant="glass-shaded">
      <div className="actionsGroupMdBetween">
        <Button
          color="accent1"
          contentBefore={<ArrowBackIcon />}
          onClick={() => router.push(`/nodes/${nodeId}/storage`)}
          size="md"
          variant="outlined"
        >
          Buckets
        </Button>
        <Button
          color="accent1"
          contentBefore={uploading ? null : <UploadFileIcon />}
          loading={uploading}
          onClick={handleUploadClick}
          size="md"
          variant="filled"
        >
          {uploading ? 'Uploading…' : 'Upload file'}
        </Button>
      </div>

      <div className={styles.infoRow}>
        <div className="textSecondary">Node:</div>
        {node.friendlyName ? (
          <div>
            <strong>{node.friendlyName}</strong>
            <div className="textSecondary">{node.id}</div>
          </div>
        ) : (
          <div>{nodeId}</div>
        )}
      </div>
      <div className={styles.infoRow}>
        <div className="textSecondary">Bucket:</div>
        <strong>{bucketId}</strong>
      </div>
      <div className={styles.infoRow}>
        <div className="textSecondary">Access:</div>
        {accessListLabels ? (
          <div className={styles.accessListsContainer}>
            <div>{accessListLabels.join(', ')}</div>
            <Button
              color="accent1"
              contentBefore={<EditIcon />}
              onClick={() => setEditAccessOpen(true)}
              size="link"
              variant="transparent"
            >
              Edit
            </Button>
          </div>
        ) : (
          <span className="textSecondary">Private (no access list)</span>
        )}
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelected} />

      <Input
        className="alignSelfStart"
        startAdornment={<SearchIcon className="textAccent1" />}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search files..."
        type="text"
        size="sm"
        value={searchTerm}
      />
      <Table<PersistentStorageFileEntry>
        autoHeight
        actionsColumn={(params) => {
          const deleting = deletingFile[`${bucketId}:${params.row.name}`] ?? false;
          return (
            <Button
              color="accent1"
              contentBefore={deleting ? null : <DeleteIcon />}
              loading={deleting}
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(params.row.name);
              }}
              size="sm"
              variant="transparent"
            >
              Delete
            </Button>
          );
        }}
        loading={loading}
        paginationType="none"
        tableType={TableTypeEnum.NODE_STORAGE_FILES}
        data={filteredFiles}
        getRowId={(row) => row.name}
      />
      <Button
        className="alignSelfEnd"
        color="accent1"
        contentBefore={<CachedIcon />}
        onClick={loadFiles}
        size="sm"
        variant="transparent"
      >
        Refresh
      </Button>
      <ConfirmModal
        confirmLabel="Delete"
        isOpen={pendingDelete !== null}
        message={`Delete ${pendingDelete}? This cannot be undone.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Delete file"
      />
      {bucket && account?.address && editAccessOpen && (
        <EditBucketAccessModal
          bucket={bucket}
          currentAccount={account.address}
          isOpen
          node={node}
          onClose={() => setEditAccessOpen(false)}
        />
      )}
    </Card>
  );
};

export default BucketFiles;
