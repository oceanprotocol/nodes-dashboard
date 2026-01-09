import InputWrapper from '@/components/input/input-wrapper';
import { styled, TextField } from '@mui/material';

const StyledTextField = styled(TextField)<{ custom_size?: 'sm' | 'md'; has_error?: boolean }>(
  ({ custom_size, disabled, has_error }) => ({
    background: disabled ? 'transparent' : 'var(--background-glass)',
    border: `1px solid var(${has_error ? '--error' : '--border-glass'})`,
    borderRadius: 24,
    lineHeight: '18px',

    fieldset: {
      border: 'none',
    },

    '& .Mui-disabled': {
      '-webkit-text-fill-color': 'var(--text-primary)',
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
  })
);

type InputProps = {
  className?: string;
  disabled?: boolean;
  endAdornment?: React.ReactNode;
  errorText?: string;
  hint?: string;
  label?: string;
  name?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  startAdornment?: React.ReactNode;
  topRight?: React.ReactNode;
  type: 'text' | 'password' | 'email' | 'number';
  value?: string | number;
};

const Input = ({
  className,
  disabled,
  endAdornment,
  errorText,
  hint,
  label,
  name,
  onBlur,
  onChange,
  placeholder,
  size = 'md',
  startAdornment,
  topRight,
  type,
  value,
}: InputProps) => (
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
      name={name}
      onBlur={onBlur}
      onChange={onChange}
      placeholder={placeholder}
      slotProps={{ input: { startAdornment, endAdornment } }}
      type={type}
      value={value}
      variant="outlined"
    />
  </InputWrapper>
);

export default Input;
