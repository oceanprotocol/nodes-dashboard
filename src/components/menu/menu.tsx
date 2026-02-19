import { Menu as MaterialMenu, styled } from '@mui/material';

const Menu = styled(MaterialMenu)({
  '& .MuiPaper-root': {
    backdropFilter: 'var(--backdrop-filter-glass)',
    background: 'var(--background-glass)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--drop-shadow-black)',
    borderRadius: 16,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: 16,
    marginTop: 8,
  },
});

export default Menu;
