import Avatar from '@/components/avatar/avatar';
import { CHAIN_ID, CHAIN_LABELS, getExplorerAddressUrl } from '@/constants/chains';
import { useProfileContext } from '@/context/profile-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatWalletAddress } from '@/utils/formatters';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LaunchIcon from '@mui/icons-material/Launch';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './account-identity.module.css';

const COPIED_RESET_MS = 1600;

// Sepolia/mainnet resolve to Etherscan, Base to Basescan — label follows the chain the app is pointed at.
const explorerLabel = CHAIN_LABELS[CHAIN_ID] === 'Base' ? 'Basescan' : 'Etherscan';

const AccountIdentity = () => {
  const { account } = useOceanAccount();
  const { ensName, ensProfile } = useProfileContext();

  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => clearTimeout(resetTimer.current);
  }, []);

  const accountName = useMemo(() => {
    if (account.isConnected && account.address) {
      return ensName || formatWalletAddress(account.address);
    }
    return 'Not connected';
  }, [account, ensName]);

  const handleCopy = async () => {
    if (!account.address) {
      return;
    }
    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
      toast.success('Address copied');
    } catch {
      toast.error('Could not copy the address. Select it and copy manually instead.');
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        {account.address ? <Avatar accountId={account.address} size={36} src={ensProfile?.avatar} /> : null}
        <div className={styles.identity}>
          <span className={styles.name} title={accountName}>
            {accountName}
          </span>

          {account.address ? (
            <div className={styles.addressRow}>
              <button className={styles.actionButton} onClick={handleCopy} type="button">
                {copied ? (
                  <CheckIcon className={styles.icon} fontSize="inherit" />
                ) : (
                  <ContentCopyIcon className={styles.icon} fontSize="inherit" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                className={styles.actionButton}
                href={getExplorerAddressUrl(account.address)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <LaunchIcon className={styles.icon} fontSize="inherit" />
                {explorerLabel}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AccountIdentity;
