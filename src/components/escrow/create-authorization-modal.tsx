import Button from '@/components/button/button';
import AuthorizationForm from '@/components/escrow/authorization-form';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import { useAuthorizeTokens } from '@/lib/use-authorize-tokens';
import { ethers } from 'ethers';
import { useState } from 'react';

type CreateAuthorizationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tokenAddress: string;
  tokenSymbol: string;
  // Consumers that already have an authorization for this token — used to block duplicates.
  existingConsumers: string[];
};

const CreateAuthorizationModal = ({
  isOpen,
  onClose,
  onSuccess,
  tokenAddress,
  tokenSymbol,
  existingConsumers,
}: CreateAuthorizationModalProps) => {
  const { handleAuthorize, isAuthorizing } = useAuthorizeTokens({ onSuccess });
  const [consumer, setConsumer] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = consumer.trim();
  const isValidAddress = ethers.isAddress(trimmed);
  const isDuplicate =
    isValidAddress && existingConsumers.some((c) => c.toLowerCase() === trimmed.toLowerCase());

  let consumerError: string | undefined;
  if (touched && !trimmed) {
    consumerError = 'Required';
  } else if (touched && !isValidAddress) {
    consumerError = 'Invalid address';
  } else if (isDuplicate) {
    consumerError = 'This consumer already has an authorization';
  }

  const consumerValid = isValidAddress && !isDuplicate;

  const handleClose = () => {
    setConsumer('');
    setTouched(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create authorization" width="sm">
      <Input
        errorText={consumerError}
        label="Consumer address"
        name="consumer"
        onBlur={() => setTouched(true)}
        onChange={(e) => setConsumer(e.target.value)}
        placeholder="0x..."
        type="text"
        value={consumer}
      />
      <AuthorizationForm
        initialValues={{ maxLockedAmount: 0, maxLockSeconds: 1, maxLockCount: 1 }}
        loading={isAuthorizing}
        onSubmit={(values) => {
          if (!consumerValid) {
            setTouched(true);
            return;
          }
          handleAuthorize({
            tokenAddress,
            spender: trimmed,
            maxLockedAmount: values.maxLockedAmount.toString(),
            maxLockSeconds: values.maxLockSeconds.toString(),
            maxLockCount: values.maxLockCount.toString(),
          });
        }}
        renderSecondaryAction={(disabled) => (
          <Button
            color="accent1"
            disabled={disabled}
            onClick={handleClose}
            size="md"
            type="button"
            variant="transparent"
          >
            Cancel
          </Button>
        )}
        renderSubmitButton={({ disabled, loading }) => (
          <Button color="accent1" disabled={disabled || !consumerValid} loading={loading} size="md" type="submit">
            Create
          </Button>
        )}
        tokenSymbol={tokenSymbol}
      />
    </Modal>
  );
};

export default CreateAuthorizationModal;
