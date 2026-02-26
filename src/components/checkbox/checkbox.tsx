import { FormControlLabel, Checkbox as MaterialCheckbox, Radio as MaterialRadio, styled } from '@mui/material';

type CheckboxProps = {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  label?: React.ReactNode;
  name?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type: 'multiple' | 'single';
  value?: string;
};

const StyledFormControlLabel = styled(FormControlLabel)({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,

  '& .MuiFormControlLabel-label.Mui-disabled': {
    color: 'var(--text-secondary)',
  },
});

const StyledCheckbox = styled(MaterialCheckbox)({
  color: 'var(--text-secondary)',

  '&.Mui-checked': {
    color: 'var(--accent1)',
  },

  '&.Mui-disabled': {
    // color: 'var(--text-secondary)',
    opacity: 0.5,
  },
});

const StyledRadio = styled(MaterialRadio)({
  color: 'var(--text-secondary)',

  '&.Mui-checked': {
    color: 'var(--accent1)',
  },

  '&.Mui-disabled': {
    // color: 'var(--text-secondary)',
    opacity: 0.5,
  },
});

const Checkbox: React.FC<CheckboxProps> = ({ checked, className, disabled, label, name, onChange, type, value }) => {
  return (
    <StyledFormControlLabel
      className={className}
      control={
        type === 'multiple' ? (
          <StyledCheckbox checked={checked} disabled={disabled} name={name} onChange={onChange} value={value} />
        ) : (
          <StyledRadio checked={checked} disabled={disabled} name={name} onChange={onChange} value={value} />
        )
      }
      label={label}
    />
  );
};

export default Checkbox;
