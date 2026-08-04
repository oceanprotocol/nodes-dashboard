'use client';

import Button from '@/components/button/button';
import DurationInput from '@/components/input/duration-input';
import Modal from '@/components/modal/modal';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { useState } from 'react';

const DEFAULT_PROLONG_SECONDS = 3600;

type ProlongSessionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the extra runtime (seconds) to add — the caller navigates to payment. */
  onConfirm: (seconds: number) => void;
};

const ProlongSessionModal: React.FC<ProlongSessionModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [seconds, setSeconds] = useState(DEFAULT_PROLONG_SECONDS);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Prolong session" width="sm" fullWidth>
      <div className="flexColumn gapMd">
        <div className="textSecondary">Choose how much extra runtime to add</div>
        <DurationInput
          availableUnits={DURATION_UNIT_OPTIONS}
          defaultUnit="hours"
          label="Additional time"
          min={0}
          onChange={setSeconds}
          size="md"
          value={seconds}
        />
        <div className="actionsGroupMdEnd">
          <Button color="accent1" variant="outlined" size="md" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            color="accent1"
            variant="filled"
            size="md"
            disabled={seconds <= 0}
            onClick={() => onConfirm(seconds)}
            type="button"
          >
            Continue to payment
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ProlongSessionModal;
