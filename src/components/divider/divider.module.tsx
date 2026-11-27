import { Divider as MaterialDivider, styled } from '@mui/material';

const Divider = styled(MaterialDivider)(() => ({
  borderColor: 'var(--border)',
  '&::before, &::after': {
    borderColor: 'var(--border)',
  },
}));

export default Divider;
