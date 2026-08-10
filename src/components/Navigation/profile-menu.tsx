import AccountIdentity from '@/components/account/account-identity';
import Menu from '@/components/menu/menu';
import { useOceanAccount } from '@/lib/use-ocean-account';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { ListItemIcon, MenuItem, styled } from '@mui/material';
import Link from 'next/link';
import { ElementType, useRef, useState } from 'react';
import Button from '../button/button';

// The identity plate reads as the header of the panel, so it keeps the divider and the wider padding
// while the actions below sit on the tighter menu rhythm.
const IdentityHeader = styled('div')({
  borderBottom: '1px solid var(--border-glass)',
  marginBottom: 6,
  padding: '6px 10px 12px',
});

// styled() drops MenuItem's polymorphic typing, so the `component`/`href` pair is re-declared here.
const StyledMenuItem = styled(MenuItem)<{ component?: ElementType; href?: string }>({
  borderRadius: 12,
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: 14,
  fontWeight: 600,
  gap: 8,
  minHeight: 0,
  padding: '8px 10px',

  '&:hover': {
    backgroundColor: 'var(--background-glass-secondary)',
  },

  '&:focus-visible': {
    outline: '2px solid var(--accent1)',
    outlineOffset: -2,
  },

  '& .MuiListItemIcon-root': {
    color: 'var(--text-secondary)',
    minWidth: 0,
  },
});

const LogoutMenuItem = styled(StyledMenuItem)({
  color: 'var(--error-darker)',

  '& .MuiListItemIcon-root': {
    color: 'var(--error-darker)',
  },
});

const Chevron = styled(ExpandMoreIcon, { shouldForwardProp: (prop) => prop !== 'is_open' })<{ is_open?: boolean }>(
  ({ is_open }) => ({
    fontSize: 18,
    transform: is_open ? 'rotate(180deg)' : 'rotate(0)',
    transition: 'transform 0.2s ease',
  })
);

type ProfileMenuProps = {
  className?: string;
};

const ProfileMenu = ({ className }: ProfileMenuProps) => {
  const { logout } = useOceanAccount();

  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isOpen = !!anchor;

  const closeMenu = () => setAnchor(null);

  const handleLogout = async () => {
    closeMenu();
    await logout();
  };

  return (
    <>
      <Button
        aria-controls={isOpen ? 'profile-menu' : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={className}
        color="accent1"
        contentAfter={<Chevron is_open={isOpen} />}
        id="profile-button"
        onClick={() => setAnchor(buttonRef.current)}
        ref={buttonRef}
      >
        My account
      </Button>
      <Menu
        anchorEl={anchor}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        id="profile-menu"
        onClose={closeMenu}
        open={isOpen}
        slotProps={{
          list: { 'aria-labelledby': 'profile-button', sx: { padding: 1, minWidth: 264 } },
        }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <IdentityHeader>
          <AccountIdentity />
        </IdentityHeader>
        <StyledMenuItem component={Link} disableRipple href="/account" onClick={closeMenu}>
          <ListItemIcon>
            <PersonOutlineIcon fontSize="small" />
          </ListItemIcon>
          My account
        </StyledMenuItem>
        <LogoutMenuItem disableRipple onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Log out
        </LogoutMenuItem>
      </Menu>
    </>
  );
};

export default ProfileMenu;
