import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { LEGACY_ESCROW_ADDRESS } from '@/constants/escrow';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import { IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import styles from './legacy-escrow-banner.module.css';

const DISMISSED_KEY = 'legacyEscrowBannerDismissed';

// Announces the escrow contract redeployment and points users with funds left in the old
// deployment to the legacy-contract withdraw flow on the escrow page. Renders only while a legacy
// address is configured, and stays hidden once dismissed.
const LegacyEscrowBanner = () => {
  // Start hidden and reveal after mount, so the server render matches the first client render and
  // the dismissed flag is only read on the client.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(DISMISSED_KEY) !== 'true');
  }, []);

  if (!LEGACY_ESCROW_ADDRESS || !visible) {
    return null;
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  return (
    <Card className={styles.banner} padding="sm" radius="md" variant="warning-outline">
      <ErrorOutlinedIcon className={styles.icon} fontSize="small" />
      <span className={styles.message}>
        A new version of the Ocean contracts was deployed. If you have funds in the old escrow contract, open the
        Manage escrow page, select the legacy contract and withdraw your funds.
      </span>
      <div className={styles.actions}>
        <Button href="/profile/escrow" size="sm" variant="outlined">
          Manage escrow
        </Button>
        <IconButton
          aria-label="Dismiss announcement"
          onClick={dismiss}
          size="small"
          sx={{ color: 'var(--text-secondary)' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
    </Card>
  );
};

export default LegacyEscrowBanner;
