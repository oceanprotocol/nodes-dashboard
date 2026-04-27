import Button from '@/components/button/button';
import Modal from '@/components/modal/modal';

type ConfirmModalProps = {
  confirmLabel?: string;
  isOpen: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  confirmLabel = 'Confirm',
  isOpen,
  message,
  onCancel,
  onConfirm,
  title = 'Confirm',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} width="xs" fullWidth>
      <p style={{ margin: 0 }}>{message}</p>
      <div className="actionsGroupMdEnd">
        <Button color="accent1" onClick={onCancel} size="md" variant="outlined" type="button">
          Cancel
        </Button>
        <Button color="accent1" onClick={onConfirm} size="md" variant="filled" type="button">
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
