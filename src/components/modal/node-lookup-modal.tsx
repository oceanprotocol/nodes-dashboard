'use client';

import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import { useState } from 'react';

type NodeLookupModalProps = {
  description: string;
  isOpen: boolean;
  onClose: () => void;
  /** Resolves to an error message to show in the form, or null on success. */
  onSubmit: (idOrName: string) => Promise<string | null>;
  submitLabel: string;
  title: string;
};

const NodeLookupModal: React.FC<NodeLookupModalProps> = ({
  description,
  isOpen,
  onClose,
  onSubmit,
  submitLabel,
  title,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) {
      return;
    }
    setError(null);
    setQuery('');
    onClose();
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('Node ID or friendly name is required');
      return;
    }
    setError(null);
    setSubmitting(true);
    let submitError: string | null;
    try {
      submitError = await onSubmit(trimmedQuery);
    } catch (err) {
      submitError = err instanceof Error ? err.message : 'Node lookup failed';
    } finally {
      setSubmitting(false);
    }
    if (submitError) {
      setError(submitError);
      return;
    }
    setQuery('');
    onClose();
  };

  return (
    <Modal hideCloseButton={submitting} isOpen={isOpen} onClose={handleClose} title={title} width="sm">
      <div className="flexColumn gapMd">
        <p>{description}</p>
        <Input
          errorText={error ?? undefined}
          label="Node ID or friendly name"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
          size="md"
          type="text"
          value={query}
        />
        <div className="actionsGroupMdEnd">
          <Button
            color="accent1"
            disabled={submitting}
            onClick={handleClose}
            size="md"
            type="button"
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            color="accent1"
            disabled={submitting || !query.trim()}
            loading={submitting}
            onClick={handleSubmit}
            size="md"
            type="button"
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default NodeLookupModal;
