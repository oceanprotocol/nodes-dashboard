'use client';

import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import { useState } from 'react';

type LookupModalProps = {
  description: string;
  isOpen: boolean;
  label: string;
  onClose: () => void;
  /** Resolves to an error message to show in the form, or null on success. */
  onSubmit: (query: string) => Promise<string | null>;
  placeholder?: string;
  submitLabel: string;
  title: string;
};

const LookupModal: React.FC<LookupModalProps> = ({
  description,
  isOpen,
  label,
  onClose,
  onSubmit,
  placeholder,
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
      setError(`${label} is required`);
      return;
    }
    setError(null);
    setSubmitting(true);
    let submitError: string | null;
    try {
      submitError = await onSubmit(trimmedQuery);
    } catch (err) {
      submitError = err instanceof Error ? err.message : 'Lookup failed';
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
          label={label}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
          placeholder={placeholder}
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

export default LookupModal;
