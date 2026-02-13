import Modal from '@/components/modal/modal';
import SwapTokens from '@/components/swap-tokens/swap-tokens';

type SwapTokensModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
  refetchOnSuccess?: boolean;
};

const SwapTokensModal: React.FC<SwapTokensModalProps> = ({ isOpen, onClose, onError, onSuccess, refetchOnSuccess }) => {
  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Convert USDC to COMPY" width="xs">
      <SwapTokens onCancel={onClose} onError={onError} onSuccess={handleSuccess} refetchOnSuccess={refetchOnSuccess} />
    </Modal>
  );
};

export default SwapTokensModal;
