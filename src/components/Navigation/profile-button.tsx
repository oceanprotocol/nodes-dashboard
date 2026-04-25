import Avatar from '@/components/avatar/avatar';
import Menu from '@/components/menu/menu';
import EditAccessListModal from '@/components/node-storage/edit-access-list-modal';
import { useProfileContext } from '@/context/profile-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { GrantStatus } from '@/types/grant';
import { formatWalletAddress } from '@/utils/formatters';
import { useAuthModal, useLogout } from '@account-kit/react';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import RedeemIcon from '@mui/icons-material/Redeem';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WalletIcon from '@mui/icons-material/Wallet';
import { ListItemIcon, MenuItem } from '@mui/material';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../button/button';
import styles from './navigation.module.css';

const ProfileButton: React.FC = () => {
  const router = useRouter();

  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();
  const { isLoggingOut, logout } = useLogout();

  const { account, provider } = useOceanAccount();

  const { ensName, ensProfile, grantStatus } = useProfileContext();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isAccessListModalOpen, setIsAccessListModalOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);

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
    setAnchorEl(buttonRef.current);
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
        ref={buttonRef}
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
            Claim grant tokens
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
          Convert to COMPY
        </MenuItem>
        {provider && (
          <MenuItem
            disableRipple
            onClick={() => {
              setIsAccessListModalOpen(true);
              handleCloseMenu();
            }}
          >
            <ListItemIcon>
              <ListAltIcon />
            </ListItemIcon>
            Edit access list
          </MenuItem>
        )}
        <MenuItem
          sx={{
            color: 'var(--error-darker)',
          }}
          disableRipple
          onClick={() => {
            logout();
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <LogoutIcon sx={{ color: 'var(--error-darker)' }} />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>
      <EditAccessListModal
        currentAccount={account.address}
        isOpen={isAccessListModalOpen}
        onClose={() => setIsAccessListModalOpen(false)}
      />
    </>
  ) : (
    <Button className={styles.loginButton} color="accent1" loading={isLoggingOut} onClick={openAuthModal}>
      Log in
    </Button>
  );
};

export default ProfileButton;
