import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { LEGACY_ESCROW_ADDRESS } from '@/constants/escrow';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import { IconButton } from '@mui/material';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import styles from './legacy-escrow-banner.module.css';

const DISMISSED_KEY = 'legacyEscrowBannerDismissed';

// Announces the escrow contract redeployment and points users with funds left in the old
// deployment to the legacy-contract withdraw flow on the escrow page. Renders only while a legacy
// address is configured, and stays hidden once dismissed.
const LegacyEscrowBanner: React.FC<{
  className?: string;
  /** Whether to show/mention the link to the escrow page */
  escrowPageLink?: boolean;
}> = ({ className, escrowPageLink }) => {
  // Start hidden and reveal after mount, so the server render matches the first client render and
  // the dismissed flag is only read on the client.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // localStorage can throw (Safari private mode, restricted iframes) — fall back to showing it.
    try {
      setVisible(localStorage.getItem(DISMISSED_KEY) !== 'true');
    } catch {
      setVisible(true);
    }
  }, []);

  if (!LEGACY_ESCROW_ADDRESS || !visible) {
    return null;
  }

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Persistence is best-effort; still hide the banner for this session.
    }
    setVisible(false);
  };

  return (
    <Card className={classNames(styles.root, className)} direction="column" radius="md" variant="warning">
      <div className={styles.row}>
        <ErrorOutlinedIcon className={styles.icon} />
        <span className={styles.message}>
          <strong>A new version of the Ocean contracts was deployed.</strong>
          <br />
          If you have funds in the old escrow contract, {escrowPageLink ? 'open the Manage escrow page,' : null} select
          the legacy contract and withdraw your funds.
        </span>
        <IconButton aria-label="Dismiss announcement" className={styles.close} onClick={dismiss} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
      {escrowPageLink ? (
        <div className="actionsGroupMdEnd">
          <Button href="/profile/escrow" size="sm" variant="outlined">
            Manage escrow
          </Button>
        </div>
      ) : null}
    </Card>
  );
};

export default LegacyEscrowBanner;
