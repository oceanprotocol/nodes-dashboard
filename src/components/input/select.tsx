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

const StyledSelect = styled(MaterialSelect)<{ customSize?: 'sm' | 'md' }>(({ customSize }) => ({
  background: 'var(--background-glass)',
  border: '1px solid var(--border-glass)',
  borderRadius: 24,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: 16,
  lineHeight: '18px',

  fieldset: {
    border: 'none',
  },

  [`& .${selectClasses.select}`]: {
    padding: customSize === 'sm' ? '4px 16px' : '12px 16px',
    minHeight: 0,
  },

  [`& .${selectClasses.icon}`]: {
    color: 'var(--text-secondary)',
  },
}));

export type SelectOption<T> = {
  label: string;
  value: T;
};

type SelectProps<T> = {
  className?: string;
  fullWidth?: boolean;
  hint?: string;
  label?: string;
  name?: string;
  options?: SelectOption<T>[];
  size?: 'sm' | 'md';
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
  hint,
  label,
  multiple,
  name,
  onChange,
  options,
  size = 'md',
  topRight,
  value,
}: SelectProps<T>) => (
  <StyledRoot className={className}>
    {label || topRight ? (
      <StyledLabelWrapper>
        <StyledLabel>{label}</StyledLabel>
        {topRight ? <StyledHint>{topRight}</StyledHint> : null}
      </StyledLabelWrapper>
    ) : null}
    <FormControl fullWidth>
      <StyledSelect customSize={size} multiple={multiple} name={name} onChange={onChange} value={value}>
        {options?.map((option) => (
          <MenuItem key={option.value as string} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </StyledSelect>
    </FormControl>
    {hint ? <StyledFooterHint>{hint}</StyledFooterHint> : null}
  </StyledRoot>
);

export default Select;
