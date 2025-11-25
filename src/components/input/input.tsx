import { FormControl, styled, TextField } from '@mui/material';

const StyledRoot = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

const StyledLabelWrapper = styled('div')({
  alignItems: 'end',
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0 16px',
});

const StyledLabel = styled('label')({
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-primary)',
});

const StyledHint = styled('div')({
  fontSize: 14,
  color: 'var(--text-secondary)',
});

const StyledFooterHint = styled(StyledHint)({
  padding: '0 16px',
});

const StyledErrorText = styled(StyledFooterHint)({
  color: 'var(--error)',
});

const StyledTextField = styled(TextField)<{ customSize?: 'sm' | 'md'; hasError?: boolean }>(
  ({ customSize, hasError }) => ({
    background: 'var(--background-glass)',
    border: `1px solid var(${hasError ? '--error' : '--border-glass'})`,
    borderRadius: 24,
    lineHeight: '18px',

    fieldset: {
      border: 'none',
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
      padding: customSize === 'sm' ? '4px 16px' : '12px 16px',
    },
  })
);

type InputProps = {
  className?: string;
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
  <StyledRoot className={className}>
    {label || topRight ? (
      <StyledLabelWrapper>
        <StyledLabel>{label}</StyledLabel>
        {topRight ? <StyledHint>{topRight}</StyledHint> : null}
      </StyledLabelWrapper>
    ) : null}
    <FormControl>
      <StyledTextField
        customSize={size}
        hasError={!!errorText}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        placeholder={placeholder}
        slotProps={{ input: { startAdornment, endAdornment } }}
        type={type}
        value={value}
        variant="outlined"
      />
    </FormControl>
    {hint ? <StyledFooterHint>{hint}</StyledFooterHint> : null}
    {errorText ? <StyledErrorText>{errorText}</StyledErrorText> : null}
  </StyledRoot>
);

export default Input;
