'use client';

import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import { useState } from 'react';

type ListNodeBucketsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves to an error message to show in the form, or null once the buckets arrived. */
  onSubmit: (peerId: string) => Promise<string | null>;
};

const ListNodeBucketsModal: React.FC<ListNodeBucketsModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const [peerId, setPeerId] = useState('');

  const handleClose = () => {
    if (listing) {
      return;
    }
    setError(null);
    setPeerId('');
    onClose();
  };

  const handleSubmit = async () => {
    if (listing) {
      return;
    }
    const trimmedPeerId = peerId.trim();
    if (!trimmedPeerId) {
      setError('Node ID is required');
      return;
    }
    setError(null);
    setListing(true);
    let submitError: string | null;
    try {
      submitError = await onSubmit(trimmedPeerId);
    } catch (err) {
      submitError = err instanceof Error ? err.message : 'Failed to list node buckets';
    } finally {
      setListing(false);
    }
    if (submitError) {
      setError(submitError);
      return;
    }
    setPeerId('');
    onClose();
  };

  return (
    <Modal hideCloseButton={listing} isOpen={isOpen} onClose={handleClose} title="List node buckets" width="sm">
      <div className="flexColumn gapMd">
        <p>Not seeing buckets from a node? Enter its peer ID below.</p>
        <Input
          errorText={error ?? undefined}
          label="Node ID"
          onChange={(e) => setPeerId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
          placeholder="Enter node peer ID"
          size="md"
          type="text"
          value={peerId}
        />
        <div className="actionsGroupMdEnd">
          <Button color="accent1" disabled={listing} onClick={handleClose} size="md" type="button" variant="outlined">
            Cancel
          </Button>
          <Button
            color="accent1"
            disabled={listing || !peerId.trim()}
            loading={listing}
            onClick={handleSubmit}
            size="md"
            type="button"
          >
            List buckets
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ListNodeBucketsModal;
