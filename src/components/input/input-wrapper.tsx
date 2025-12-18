import { styled } from '@mui/material';

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

type InputWrapperProps = {
  children: React.ReactNode;
  className?: string;
  errorText?: string | string[];
  hint?: string;
  label?: string;
  topRight?: React.ReactNode;
};

const InputWrapper = ({ children, className, errorText, hint, label, topRight }: InputWrapperProps) => (
  <StyledRoot className={className}>
    {label || topRight ? (
      <StyledLabelWrapper>
        <StyledLabel>{label}</StyledLabel>
        {topRight ? <StyledHint>{topRight}</StyledHint> : null}
      </StyledLabelWrapper>
    ) : null}
    {children}
    {hint ? <StyledFooterHint>{hint}</StyledFooterHint> : null}
    {errorText ? (
      <StyledErrorText>{Array.isArray(errorText) ? errorText.join(' | ') : errorText}</StyledErrorText>
    ) : null}
  </StyledRoot>
);

export default InputWrapper;
