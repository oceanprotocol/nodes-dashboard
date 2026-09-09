import Modal from '@/components/modal/modal';
import styles from './login-modal.module.css';
import WalletList, { type WalletListProps } from './wallet-list';

type LoginModalProps = WalletListProps & {
  isOpen: boolean;
  onClose: () => void;
};

/** Shown only when Privy is unavailable; normally the list portals into Privy's own modal. */
const LoginModal = ({ isOpen, onClose, ...walletListProps }: LoginModalProps) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Connect a wallet" width="xs">
    <div className={styles.root}>
      <WalletList {...walletListProps} onConnected={onClose} />
      <p className={styles.note}>Email, Google and passkey login is unavailable right now.</p>
    </div>
  </Modal>
);

export default LoginModal;
