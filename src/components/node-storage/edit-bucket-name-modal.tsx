'use client';

import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import { MAX_BUCKET_NAME_LENGTH, useNodeStorage } from '@/contexts/node-storage-context';
import { Node } from '@/types/nodes';
import { formatError } from '@/utils/formatters';
import { PersistentStorageBucket } from '@oceanprotocol/lib';
import { useState } from 'react';
import { toast } from 'react-toastify';

type EditBucketNameModalProps = {
  bucket: PersistentStorageBucket;
  isOpen: boolean;
  node: Node;
  onClose: () => void;
};

const EditBucketNameModal: React.FC<EditBucketNameModalProps> = ({ bucket, isOpen, node, onClose }) => {
  const { renameBucket } = useNodeStorage();

  const nodeId = node.id ?? node.nodeId ?? '';
  const nodeUri = node.currentAddrs?.length ? node.currentAddrs : nodeId;

  const [name, setName] = useState(bucket.label ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (name.trim().length > MAX_BUCKET_NAME_LENGTH) {
      toast.error('Name is too long');
      return;
    }
    setSaving(true);
    try {
      await renameBucket({ bucketId: bucket.bucketId, label: name.trim() || null, nodeId, nodeUri });
      toast.success('Bucket name updated');
      onClose();
    } catch (e: any) {
      toast.error(formatError({ error: e, fallback: 'The bucket name could not be updated.' }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit bucket name" width="md" fullWidth>
      <div className="flexColumn gapMd">
        <Input
          type="text"
          label="Name"
          placeholder="Leave blank to use the bucket ID"
          size="md"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint={bucket.bucketId}
        />
        <div className="actionsGroupMdEnd">
          <Button color="accent1" variant="outlined" size="md" onClick={onClose} disabled={saving} type="button">
            Cancel
          </Button>
          <Button color="accent1" variant="filled" size="md" loading={saving} onClick={handleSave} type="button">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditBucketNameModal;
