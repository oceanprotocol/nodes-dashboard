import { Collapse, styled } from '@mui/material';
import { TransitionGroup } from 'react-transition-group';

const StyledRoot = styled('div')<{ disabled?: boolean }>(({ disabled }) => ({
  display: 'flex',
  flexDirection: 'column',
  opacity: disabled ? 0.5 : 1,
}));

const StyledLabelWrapper = styled('div')({
  alignItems: 'end',
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 4,
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
  marginTop: 4,
  padding: '0 16px',
});

const StyledErrorText = styled(StyledFooterHint)({
  color: 'var(--error)',
});

type InputWrapperProps = {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  errorText?: string | string[];
  hint?: React.ReactNode;
  label?: React.ReactNode;
  topRight?: React.ReactNode;
};

const InputWrapper = ({ children, className, disabled, errorText, hint, label, topRight }: InputWrapperProps) => (
  <StyledRoot className={className} disabled={disabled}>
    {label || topRight ? (
      <StyledLabelWrapper>
        <StyledLabel>{label}</StyledLabel>
        {topRight ? <StyledHint>{topRight}</StyledHint> : null}
      </StyledLabelWrapper>
    ) : null}
    {children}
    <TransitionGroup>
      {hint ? (
        <Collapse>
          <StyledFooterHint>{hint}</StyledFooterHint>
        </Collapse>
      ) : null}
      {errorText ? (
        <Collapse>
          <StyledErrorText>{Array.isArray(errorText) ? errorText.join(' | ') : errorText}</StyledErrorText>
        </Collapse>
      ) : null}
    </TransitionGroup>
  </StyledRoot>
);

export default InputWrapper;
