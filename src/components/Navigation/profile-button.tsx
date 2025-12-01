import Avatar from '@/components/avatar/avatar';
import { useProfileContext } from '@/context/profile-context';
import { formatWalletAddress } from '@/utils/formatters';
import PersonIcon from '@mui/icons-material/Person';
import WalletIcon from '@mui/icons-material/Wallet';
import { ListItemIcon, Menu, MenuItem } from '@mui/material';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Button from '../button/button';
import styles from './navigation.module.css';

const ProfileButton = () => {
  const { open } = useAppKit();
  const account = useAppKitAccount();
  const router = useRouter();

  const { ensName, ensProfile } = useProfileContext();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleOpenMenu = () => {
    setAnchorEl(document.getElementById('profile-button'));
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const accountName = useMemo(() => {
    if (account.status === 'connected' && account.address) {
      if (ensName) {
        return ensName;
      }
      if (account.address) {
        return formatWalletAddress(account.address);
      }
    }
    return 'Not connected';
  }, [account, ensName]);

  return isClient && account?.status === 'connected' ? (
    <>
      <Button
        className={styles.loginButton}
        contentBefore={
          account.address ? <Avatar accountId={account.address} size="sm" src={ensProfile?.avatar} /> : <WalletIcon />
        }
        id="profile-button"
        onClick={() => {
          handleOpenMenu();
        }}
      >
        {accountName}
      </Button>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        disableScrollLock
        onClose={handleCloseMenu}
        open={!!anchorEl}
        slotProps={{
          list: {
            'aria-labelledby': 'profile-button',
          },
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <MenuItem
          onClick={() => {
            router.push('/profile/consumer');
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <PersonIcon />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem
          onClick={() => {
            open();
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <WalletIcon />
          </ListItemIcon>
          Wallet
        </MenuItem>
      </Menu>
    </>
  ) : (
    <Button
      className={styles.loginButton}
      onClick={() => {
        open();
      }}
    >
      {account?.status === 'connecting' ? 'Connecting...' : 'Log In'}
    </Button>
  );
};

export default ProfileButton;
