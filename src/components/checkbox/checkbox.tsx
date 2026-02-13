import { FormControlLabel, Checkbox as MaterialCheckbox, Radio as MaterialRadio, styled } from '@mui/material';

type CheckboxProps = {
  checked: boolean;
  className?: string;
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
});

const StyledCheckbox = styled(MaterialCheckbox)({
  color: 'var(--border-glass)',

  '&.Mui-checked': {
    color: 'var(--accent1)',
  },
});

const StyledRadio = styled(MaterialRadio)({
  color: 'var(--border-glass)',

  '&.Mui-checked': {
    color: 'var(--accent1)',
  },
});

const Checkbox: React.FC<CheckboxProps> = ({ checked, className, label, name, onChange, type, value }) => {
  return (
    <StyledFormControlLabel
      className={className}
      control={
        type === 'multiple' ? (
          <StyledCheckbox checked={checked} name={name} onChange={onChange} value={value} />
        ) : (
          <StyledRadio checked={checked} name={name} onChange={onChange} value={value} />
        )
      }
      label={label}
    />
  );
};

export default Checkbox;
