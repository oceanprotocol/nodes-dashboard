import Button from '@/components/button/button';
import AuthorizationForm from '@/components/escrow/authorization-form';
import Modal from '@/components/modal/modal';
import { useAuthorizeTokens } from '@/lib/use-authorize-tokens';
import { EscrowSpenderInfo } from '@/lib/use-escrow-data';

type EditAuthorizationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  spender: EscrowSpenderInfo;
};

const EditAuthorizationModal = ({ isOpen, onClose, onSuccess, spender }: EditAuthorizationModalProps) => {
  const { handleAuthorize, isAuthorizing } = useAuthorizeTokens({ onSuccess });

  const { authorizations, tokenAddress, tokenSymbol } = spender;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit authorization" width="sm">
      <AuthorizationForm
        initialValues={{
          maxLockedAmount: Number(authorizations.maxLockedAmount),
          maxLockSeconds: Number(authorizations.maxLockSeconds),
          maxLockCount: Number(authorizations.maxLockCounts),
        }}
        loading={isAuthorizing}
        minLockCount={Number(authorizations.currentLocks) || 1}
        onSubmit={(values) =>
          handleAuthorize({
            tokenAddress,
            spender: spender.spender,
            maxLockedAmount: values.maxLockedAmount.toString(),
            maxLockSeconds: values.maxLockSeconds.toString(),
            maxLockCount: values.maxLockCount.toString(),
          })
        }
        renderSecondaryAction={(disabled) => (
          <Button color="accent1" disabled={disabled} onClick={onClose} size="md" type="button" variant="transparent">
            Cancel
          </Button>
        )}
        renderSubmitButton={({ disabled, loading }) => (
          <Button color="accent1" disabled={disabled} loading={loading} size="md" type="submit">
            Save
          </Button>
        )}
        tokenSymbol={tokenSymbol}
      />
    </Modal>
  );
};

export default EditAuthorizationModal;
