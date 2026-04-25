'use client';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import ConfirmModal from '@/components/modal/confirm-modal';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { Node } from '@/types/nodes';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CachedIcon from '@mui/icons-material/Cached';
import DeleteIcon from '@mui/icons-material/Delete';
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

  const { bucketFiles, fetchingFiles, uploadingFile, deletingFile, fetchBucketFiles, uploadFile, deleteFile } =
    useNodeStorage();

  const nodeId = node.id ?? node.nodeId ?? '';

  const [alreadyLoaded, setAlreadyLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const nodeUri = useMemo(
    () => (node.currentAddrs?.length ? node.currentAddrs : (node.id ?? node.nodeId ?? '')),
    [node]
  );

  const loading = fetchingFiles[bucketId] ?? false;
  const uploading = uploadingFile[bucketId] ?? false;

  const loadFiles = useCallback(async () => {
    try {
      await fetchBucketFiles({ bucketId, nodeUri });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load files');
    }
  }, [bucketId, nodeUri, fetchBucketFiles]);

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
      await uploadFile({ bucketId, nodeUri, file });
      toast.success(`${file.name} uploaded`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Upload failed');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    const fileName = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteFile({ bucketId, fileName, nodeUri });
      toast.success(`${fileName} deleted`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Delete failed');
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
    </Card>
  );
};

export default BucketFiles;
