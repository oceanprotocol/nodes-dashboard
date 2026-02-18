import InputWrapper from '@/components/input/input-wrapper';
import { Checkbox, ListItemText, Select as MaterialSelect, MenuItem, selectClasses, styled } from '@mui/material';
import { useMemo } from 'react';

const StyledMultipleValueContainer = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
});

const StyledSelect = styled(MaterialSelect, {
  shouldForwardProp: (prop) => prop !== 'has_error' && prop !== 'custom_size',
})<{ custom_size?: 'sm' | 'md'; has_error?: boolean }>(({ custom_size, has_error }) => ({
  background: 'var(--background-glass)',
  border: `1px solid var(${has_error ? '--error' : '--border'})`,
  boxShadow: has_error ? 'var(--input-shadow-error)' : undefined,
  borderRadius: 24,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: 16,
  lineHeight: '18px',
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',

  '&.Mui-focused': {
    boxShadow: has_error ? 'var(--input-shadow-error), var(--input-shadow-focus)' : 'var(--input-shadow-focus)',
  },

  fieldset: {
    border: 'none',
  },

  [`& .${selectClasses.select}`]: {
    padding: custom_size === 'sm' ? '4px 16px' : '12px 16px',
    minHeight: 0,

    '& > .MuiListItemText-root': {
      marginBottom: 0,
      marginTop: 0,

      '& > .MuiListItemText-primary': {
        lineHeight: custom_size === 'sm' ? '22px' : '24px',
      },
    },
  },

  [`& .${selectClasses.icon}`]: {
    color: 'var(--text-secondary)',
    position: 'relative',
  },
}));

export type SelectOption<T> = {
  label: string;
  value: T;
};

type SelectProps<T> = {
  className?: string;
  endAdornment?: React.ReactNode;
  errorText?: string | string[];
  fullWidth?: boolean;
  hint?: string;
  label?: string;
  name?: string;
  MenuProps?: any;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  options?: SelectOption<T>[];
  renderOption?: (option: SelectOption<T>) => React.ReactNode;
  renderSelectedValue?: (label: string) => React.ReactNode;
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
  endAdornment,
  errorText,
  hint,
  label,
  multiple,
  name,
  MenuProps,
  onBlur,
  onChange,
  options,
  renderOption,
  renderSelectedValue,
  size = 'md',
  topRight,
  value,
}: SelectProps<T>) => {
  const memoizedRenderValue = useMemo<((value: any) => React.ReactNode) | undefined>(() => {
    if (multiple) {
      const MultiRenderValue = (value: T[]) => (
        <StyledMultipleValueContainer>
          {options
            ?.filter((option) => value.includes(option.value))
            .map((option) => (
              <div className="chip chipGlass" key={String(option.value)}>
                {renderSelectedValue?.(option.label) ?? option.label}
              </div>
            ))}
        </StyledMultipleValueContainer>
      );
      (MultiRenderValue as any).displayName = 'SelectMultiRenderValue';
      return MultiRenderValue as (value: any) => React.ReactNode;
    }
    return undefined;
  }, [multiple, options, renderSelectedValue]);

  return (
    <InputWrapper className={className} errorText={errorText} hint={hint} label={label} topRight={topRight}>
      <StyledSelect
        custom_size={size}
        endAdornment={endAdornment}
        has_error={!!errorText}
        inputProps={{}}
        MenuProps={{ disableScrollLock: true, ...MenuProps }}
        multiple={multiple}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        renderValue={memoizedRenderValue}
        value={multiple ? (value ?? []) : value}
      >
        {options?.map((option) => (
          <MenuItem key={String(option.value)} value={option.value}>
            {multiple ? (
              <Checkbox checked={Array.isArray(value) ? (value as any).includes(option.value) : false} />
            ) : null}
            <ListItemText primary={renderOption?.(option) ?? option.label} />
          </MenuItem>
        ))}
      </StyledSelect>
    </InputWrapper>
  );
};

export default Select;
