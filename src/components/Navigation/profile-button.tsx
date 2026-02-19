import Avatar from '@/components/avatar/avatar';
import { useProfileContext } from '@/context/profile-context';
import useTokenSymbol from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { GrantStatus } from '@/types/grant';
import { formatWalletAddress } from '@/utils/formatters';
import { useAuthModal, useLogout } from '@account-kit/react';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import RedeemIcon from '@mui/icons-material/Redeem';
import WalletIcon from '@mui/icons-material/Wallet';
import { ListItemIcon, Menu, MenuItem } from '@mui/material';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import posthog from 'posthog-js'
import Button from '../button/button';
import styles from './navigation.module.css';

const ProfileButton = () => {
  const router = useRouter();

  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();
  const { isLoggingOut, logout } = useLogout();

  const { account } = useOceanAccount();

  const { ensName, ensProfile, grantStatus } = useProfileContext();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isClient, setIsClient] = useState(false);

  const grantAmount = process.env.NEXT_PUBLIC_GRANT_AMOUNT;
  const grantTokenSymbol = useTokenSymbol(process.env.NEXT_PUBLIC_GRANT_TOKEN_ADDRESS);

  // This is a workaround for the modal not closing after connecting
  // https://github.com/alchemyplatform/aa-sdk/issues/2327
  // TODO remove once the issue is fixed
  useEffect(() => {
    if (isAuthModalOpen && account.isConnected) {
      closeAuthModal();
    }
  }, [account.isConnected, closeAuthModal, isAuthModalOpen]);

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
    if (account.isConnected && account.address) {
      if (ensName) {
        return ensName;
      }
      if (account.address) {
        return formatWalletAddress(account.address);
      }
    }
    return 'Not connected';
  }, [account, ensName]);

  return isClient && account?.isConnected ? (
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
        {grantStatus === GrantStatus.CLAIMED ? null : (
          <MenuItem
            onClick={() => {
              router.push('/grant/details');
              handleCloseMenu();
            }}
          >
            <ListItemIcon>
              <RedeemIcon />
            </ListItemIcon>
            {grantAmount && grantTokenSymbol ? `Get ${grantAmount} ${grantTokenSymbol}` : 'Get grant'}
          </MenuItem>
        )}
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
        {/* <MenuItem
          onClick={() => {
            openAuthModal();
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <WalletIcon />
          </ListItemIcon>
          Wallet
        </MenuItem> */}
        <MenuItem
          onClick={() => {
            logout();
            posthog.reset()
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>
    </>
  ) : (
    <Button className={styles.loginButton} loading={isLoggingOut} onClick={openAuthModal}>
      Log in
    </Button>
  );
};

export default ProfileButton;
