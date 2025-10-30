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

const StyledTopRight = styled('div')({
  fontSize: 14,
  color: 'var(--text-secondary)',
});

const StyledTextField = styled(TextField)<{ customSize?: 'sm' | 'md' }>(({ customSize }) => ({
  background: 'var(--background-glass)',
  border: '1px solid var(--border-glass)',
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
}));

type InputProps = {
  className?: string;
  endAdornment?: React.ReactNode;
  label?: string;
  name?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  startAdornment?: React.ReactNode;
  topRight?: React.ReactNode;
  value?: string;
};

const Input = ({
  className,
  endAdornment,
  label,
  name,
  onChange,
  placeholder,
  size = 'md',
  startAdornment,
  topRight,
  value,
}: InputProps) => (
  <StyledRoot className={className}>
    {label || topRight ? (
      <StyledLabelWrapper>
        <StyledLabel>{label}</StyledLabel>
        {topRight ? <StyledTopRight>{topRight}</StyledTopRight> : null}
      </StyledLabelWrapper>
    ) : null}
    <FormControl>
      <StyledTextField
        customSize={size}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        slotProps={{ input: { startAdornment, endAdornment } }}
        value={value}
        variant="outlined"
      />
    </FormControl>
  </StyledRoot>
);

export default Input;
