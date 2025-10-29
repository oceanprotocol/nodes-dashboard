import { FormControl, Select as MaterialSelect, MenuItem, selectClasses, styled } from '@mui/material';

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
  fontWeight: 700,
  color: 'var(--text-primary)',
});

const StyledTopRight = styled('div')({
  fontSize: 14,
  color: 'var(--text-secondary)',
});

const StyledSelect = styled(MaterialSelect)<{ small?: boolean }>(({ small }) => ({
  background: 'var(--background-glass)',
  border: '1px solid var(--border-glass)',
  borderRadius: 20,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: 16,
  lineHeight: 1.2,

  fieldset: {
    border: 'none',
  },

  [`& .${selectClasses.select}`]: {
    padding: small ? '12px 16px' : '6px 16px',
    minHeight: 0,
  },

  [`& .${selectClasses.icon}`]: {
    color: 'var(--text-secondary)',
  },
}));

type InputProps<T> = {
  className?: string;
  fullWidth?: boolean;
  label?: string;
  options?: { label: string; value: T }[];
  small?: boolean;
  topRight?: React.ReactNode;
} & (
  | {
      multiple?: false;
      onChange?: (e: any) => void;
      value?: T;
    }
  | {
      multiple: true;
      onChange?: (e: any) => void;
      value?: T[];
    }
);

const Select = <T extends string | number = string>({
  className,
  fullWidth,
  label,
  multiple,
  onChange,
  options,
  small,
  topRight,
  value,
}: InputProps<T>) => (
  <StyledRoot className={className}>
    {label || topRight ? (
      <StyledLabelWrapper>
        <StyledLabel>{label}</StyledLabel>
        {topRight ? <StyledTopRight>{topRight}</StyledTopRight> : null}
      </StyledLabelWrapper>
    ) : null}
    <FormControl fullWidth={fullWidth}>
      <StyledSelect value={value} label="Age" multiple={multiple} onChange={onChange} small={small}>
        {options?.map((option) => (
          <MenuItem key={option.value as string} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </StyledSelect>
    </FormControl>
  </StyledRoot>
);

export default Select;
