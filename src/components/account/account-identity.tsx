import Avatar from '@/components/avatar/avatar';
import { useProfileContext } from '@/context/profile-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatWalletAddress } from '@/utils/formatters';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './account-identity.module.css';

const COPIED_RESET_MS = 1600;

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
        {account.address ? <Avatar accountId={account.address} size={44} src={ensProfile?.avatar} /> : null}
        <span className={styles.name} title={accountName}>
          {accountName}
        </span>
      </div>
      {account.address ? (
        <button className={styles.copy} onClick={handleCopy} type="button">
          <span className={styles.address}>{account.address}</span>
          <span className={styles.copyAction}>
            {copied ? <CheckIcon className={styles.copyIcon} /> : <ContentCopyIcon className={styles.copyIcon} />}
            {copied ? 'Copied' : 'Copy address'}
          </span>
        </button>
      ) : null}
    </div>
  );
};

export default AccountIdentity;
