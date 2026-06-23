import Button from '@/components/button/button';
import Modal from '@/components/modal/modal';
import { useAuthorizeTokens } from '@/lib/use-authorize-tokens';
import { EscrowSpenderInfo } from '@/lib/use-escrow-data';
import { formatWalletAddress } from '@/utils/formatters';

type RevokeAuthorizationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  spender: EscrowSpenderInfo;
};

// Revoking an authorization is done by re-authorizing the same spender with all limits set to
// zero — the contract has no dedicated revoke call, a zeroed authorization can no longer lock funds.
const RevokeAuthorizationModal = ({ isOpen, onClose, onSuccess, spender }: RevokeAuthorizationModalProps) => {
  const { handleAuthorize, isAuthorizing } = useAuthorizeTokens({ onSuccess });

  // Match the card's active-locks display, which lists spender.locks (currentLocks can lag behind).
  const hasActiveLocks = (spender.locks ?? []).length > 0;

  const handleRevoke = () =>
    handleAuthorize({
      tokenAddress: spender.tokenAddress,
      spender: spender.spender,
      maxLockedAmount: '0',
      maxLockSeconds: '0',
      maxLockCount: '0',
    });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Revoke authorization" width="sm">
      {hasActiveLocks ? (
        <p>
          This authorization has active locks.
          <br />
          Wait until those locks are released before revoking.
        </p>
      ) : (
        <p>
          Remove the spending authorization for consumer <strong>{formatWalletAddress(spender.spender)}</strong>?
          <br />
          This sets all limits to zero, so it can no longer pay for compute jobs with {spender.tokenSymbol}.
        </p>
      )}
      <div className="actionsGroupMdEnd">
        <Button
          color="accent1"
          disabled={isAuthorizing}
          onClick={onClose}
          size="md"
          type="button"
          variant="transparent"
        >
          Cancel
        </Button>
        {hasActiveLocks ? null : (
          <Button
            color="error"
            disabled={hasActiveLocks}
            loading={isAuthorizing}
            onClick={handleRevoke}
            size="md"
            type="button"
          >
            Revoke
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default RevokeAuthorizationModal;
