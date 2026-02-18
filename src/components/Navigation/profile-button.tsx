import Avatar from '@/components/avatar/avatar';
import { useProfileContext } from '@/context/profile-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { GrantStatus } from '@/types/grant';
import { formatWalletAddress } from '@/utils/formatters';
import { useAuthModal, useLogout } from '@account-kit/react';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import RedeemIcon from '@mui/icons-material/Redeem';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WalletIcon from '@mui/icons-material/Wallet';
import { ListItemIcon, Menu, MenuItem, styled } from '@mui/material';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Button from '../button/button';
import styles from './navigation.module.css';

const StyledMenu = styled(Menu)({
  '& .MuiPaper-root': {
    backdropFilter: 'var(--backdrop-filter-glass)',
    background: 'var(--background-glass)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--drop-shadow-black)',
    borderRadius: 16,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: 16,
  },
});

const ProfileButton = () => {
  const router = useRouter();

  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();
  const { isLoggingOut, logout } = useLogout();

  const { account } = useOceanAccount();

  const { ensName, ensProfile, grantStatus } = useProfileContext();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isClient, setIsClient] = useState(false);

  const grantAmount = process.env.NEXT_PUBLIC_GRANT_AMOUNT;

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
        color="accent1"
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
      <StyledMenu
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
          disableRipple
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
        {grantStatus === GrantStatus.CLAIMED ? null : (
          <MenuItem
            disableRipple
            onClick={() => {
              router.push('/grant/details');
              handleCloseMenu();
            }}
          >
            <ListItemIcon>
              <RedeemIcon />
            </ListItemIcon>
            Claim {grantAmount} COMPY
          </MenuItem>
        )}
        <MenuItem
          disableRipple
          onClick={() => {
            router.push('/swap-tokens');
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <SwapHorizIcon />
          </ListItemIcon>
          Convert USDC to COMPY
        </MenuItem>
        <MenuItem
          disableRipple
          onClick={() => {
            logout();
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          Log out
        </MenuItem>
      </StyledMenu>
    </>
  ) : (
    <Button className={styles.loginButton} color="accent1" loading={isLoggingOut} onClick={openAuthModal}>
      Log in
    </Button>
  );
};

export default ProfileButton;
