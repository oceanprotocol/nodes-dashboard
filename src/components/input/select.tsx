import InputWrapper from '@/components/input/input-wrapper';
import {
  Checkbox,
  Collapse,
  ListItemText,
  Select as MaterialSelect,
  MenuItem,
  PopoverPaper,
  selectClasses,
  styled,
} from '@mui/material';
import { useMemo } from 'react';
import { TransitionGroup } from 'react-transition-group';

const StyledTransitionGroup = styled(TransitionGroup)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
});

const StyledSelect = styled(MaterialSelect, {
  shouldForwardProp: (prop) => prop !== 'has_error' && prop !== 'custom_size',
})<{ custom_size?: 'sm' | 'md'; has_error?: boolean }>(({ custom_size, has_error }) => ({
  alignItems: 'center',
  background: 'var(--background-glass)',
  border: `1px solid var(${has_error ? '--error' : '--border'})`,
  boxShadow: has_error ? 'var(--input-shadow-error)' : undefined,
  borderRadius: 24,
  color: 'var(--text-primary)',
  display: 'inline-flex',
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: 16,
  lineHeight: '22px',
  minHeight: custom_size === 'sm' ? 34 : 50,
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',

  '&.Mui-focused': {
    boxShadow: has_error ? 'var(--input-shadow-error), var(--input-shadow-focus)' : 'var(--input-shadow-focus)',
  },

  fieldset: {
    border: 'none',
  },

  menu: {
    background: 'red',
  },

  [`& .${selectClasses.select}`]: {
    padding: custom_size === 'sm' ? '4px 16px' : '8px 16px',
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

const StyledPaper = styled(PopoverPaper)({
  backdropFilter: 'var(--backdrop-filter-glass)',
  background: 'var(--background-glass)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--drop-shadow-black)',
  borderRadius: 16,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: 16,
  marginTop: 8,
});

const StyledPlaceholder = styled('span')({
  color: 'var(--text-secondary)',
  fontSize: 14,
  lineHeight: '16px',
});

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
  placeholder?: string;
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
  placeholder,
  renderOption,
  renderSelectedValue,
  size = 'md',
  topRight,
  value,
}: SelectProps<T>) => {
  const memoizedRenderValue = useMemo<((value: any) => React.ReactNode) | undefined>(() => {
    if (multiple) {
      const MultiRenderValue = (value: T[]) => {
        const selectedValues = options?.filter((option) => value.includes(option.value));
        return (
          <StyledTransitionGroup>
            {selectedValues?.length ? (
              selectedValues.map((option) => (
                <Collapse key={String(option.value)} orientation="horizontal">
                  <div className="chip chipGlass">{renderSelectedValue?.(option.label) ?? option.label}</div>
                </Collapse>
              ))
            ) : placeholder ? (
              <Collapse orientation="horizontal">
                <StyledPlaceholder>{placeholder}</StyledPlaceholder>
              </Collapse>
            ) : null}
          </StyledTransitionGroup>
        );
      };
      return MultiRenderValue;
    }
    const SingleRenderValue = (value: T) => {
      if (value) {
        const selectedOption = options?.find((option) => option.value === value);
        if (selectedOption) {
          return selectedOption.label;
        }
      }
      if (placeholder) {
        return <StyledPlaceholder>{placeholder}</StyledPlaceholder>;
      }
      return null;
    };
    return SingleRenderValue;
  }, [multiple, options, placeholder, renderSelectedValue]);

  return (
    <InputWrapper className={className} errorText={errorText} hint={hint} label={label} topRight={topRight}>
      <StyledSelect
        custom_size={size}
        displayEmpty
        endAdornment={endAdornment}
        has_error={!!errorText}
        inputProps={{}}
        MenuProps={{ slots: { paper: StyledPaper, ...MenuProps?.slots }, ...MenuProps }}
        multiple={multiple}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        renderValue={memoizedRenderValue}
        value={multiple ? (value ?? []) : value}
      >
        {options?.map((option) => (
          <MenuItem disableRipple key={String(option.value)} value={option.value}>
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
