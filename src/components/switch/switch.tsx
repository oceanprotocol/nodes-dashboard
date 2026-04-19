import { FormControlLabel, Switch as MaterialSwitch, styled } from '@mui/material';
import React from 'react';

type SwitchProps = {
  checked?: boolean;
  className?: string;
  label?: React.ReactNode;
  name?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
  value?: unknown;
};

const StyledFormControlLabel = styled(FormControlLabel)({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,

  '& .MuiFormControlLabel-label.Mui-disabled': {
    color: 'var(--text-secondary)',
  },
});

const StyledSwitch = styled(MaterialSwitch)(() => ({
  height: 24,
  margin: '4px 0 4px 12px',
  padding: 0,
  width: 40,
  '&:active': {
    '& .MuiSwitch-thumb': {
      transform: 'scale(0.9)',
    },
  },
  '& .MuiSwitch-switchBase': {
    padding: 2,
    '&.Mui-checked': {
      transform: 'translateX(16px)',
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: 'var(--accent1)',
      },
    },
  },
  '& .MuiSwitch-thumb': {
    boxShadow: 'none',
    color: 'var(--text-primary-inverse)',
    width: 20,
  },
  '& .MuiSwitch-track': {
    background: 'var(--border)',
    borderRadius: 12,
    opacity: 1,
  },
}));

const Switch: React.FC<SwitchProps> = ({ className, label, name, checked, onChange, value = true }) => {
  return (
    <StyledFormControlLabel
      className={className}
      control={<StyledSwitch checked={checked} name={name} onChange={onChange} />}
      label={label}
      value={value}
    />
  );
};

export default Switch;
