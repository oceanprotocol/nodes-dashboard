import InputWrapper from '@/components/input/input-wrapper';
import { styled, TextField } from '@mui/material';
import React from 'react';

const StyledTextField = styled(TextField, {
  shouldForwardProp: (prop) => prop !== 'has_error' && prop !== 'custom_size',
})<{ custom_size?: 'sm' | 'md'; has_error?: boolean }>(({ custom_size, disabled, has_error }) => ({
  background: disabled ? 'transparent' : 'var(--background-glass)',
  border: `1px solid var(${has_error ? '--error' : '--border-glass'})`,
  boxShadow: has_error ? 'var(--input-shadow-error)' : undefined,
  borderRadius: 24,
  lineHeight: '18px',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',

  '&:focus-within': {
    boxShadow: has_error ? 'var(--input-shadow-error), var(--input-shadow-focus)' : 'var(--input-shadow-focus)',
  },

  fieldset: {
    border: 'none',
  },

  '& .Mui-disabled': {
    WebkitTextFillColor: 'var(--text-primary)',
  },

  '& .MuiInputBase-root': {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-inter), sans-serif',
  },

  '& .MuiInputBase-input': {
    color: 'var(--text-primary)',
    fontSize: 16,
    lineHeight: '18px',
    minHeight: 0,
    padding: custom_size === 'sm' ? '4px 16px' : '12px 16px',
  },
}));

type InputProps = {
  className?: string;
  disabled?: boolean;
  endAdornment?: React.ReactNode;
  errorText?: string;
  hint?: string;
  label?: string;
  max?: number;
  min?: number;
  name?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  startAdornment?: React.ReactNode;
  topRight?: React.ReactNode;
  type: 'text' | 'password' | 'email' | 'number';
  value?: string | number;
};

const Input: React.FC<InputProps> = ({
  className,
  disabled,
  endAdornment,
  errorText,
  hint,
  label,
  max,
  min,
  name,
  onBlur,
  onChange,
  onKeyDown,
  onKeyUp,
  placeholder,
  size = 'md',
  startAdornment,
  topRight,
  type,
  value,
}) => (
  <InputWrapper
    className={className}
    disabled={disabled}
    errorText={errorText}
    hint={hint}
    label={label}
    topRight={topRight}
  >
    <StyledTextField
      custom_size={size}
      disabled={disabled}
      has_error={!!errorText}
      inputProps={{ max, min }}
      name={name}
      onBlur={onBlur}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      placeholder={placeholder}
      slotProps={{ input: { startAdornment, endAdornment } }}
      type={type}
      value={value}
      variant="outlined"
    />
  </InputWrapper>
);

export default Input;
