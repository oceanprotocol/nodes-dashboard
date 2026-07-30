import type { DiscoveredWallet } from '@/lib/use-injected-wallet';
import styles from './wallet-list.module.css';

export type WalletListProps = {
  error?: string;
  isConnecting: boolean;
  onConnect: (rdns: string) => Promise<boolean>;
  onConnected?: () => void;
  wallets: DiscoveredWallet[];
};

/** Shared by the fallback modal and the section portaled into Privy's modal. */
const WalletList = ({ error, isConnecting, onConnect, onConnected, wallets }: WalletListProps) => {
  const handleConnect = async (rdns: string) => {
    if (await onConnect(rdns)) {
      onConnected?.();
    }
  };

  return (
    <div className={styles.root}>
      {wallets.length === 0 ? (
        <p className={styles.empty}>No browser wallet detected.</p>
      ) : (
        wallets.map((wallet) => (
          <button
            className={styles.wallet}
            disabled={isConnecting}
            key={wallet.rdns}
            onClick={() => handleConnect(wallet.rdns)}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- EIP-6963 icons are data: URIs, nothing for next/image to optimize */}
            {wallet.icon && <img alt="" className={styles.walletIcon} src={wallet.icon} />}
            {wallet.name}
          </button>
        ))
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};

export default WalletList;
