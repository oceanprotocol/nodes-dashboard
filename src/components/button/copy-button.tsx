import Button, { ButtonProps } from '@/components/button/button';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useState } from 'react';

type CopyButtonProps = Pick<ButtonProps, 'className' | 'color' | 'size' | 'variant'> & {
  contentToCopy: string;
  label?: string;
  labelCopied?: string;
};

const CopyButton: React.FC<CopyButtonProps> = ({
  className,
  color = 'accent2',
  contentToCopy,
  label = 'Copy',
  labelCopied = 'Copied!',
  size = 'sm',
  variant = 'filled',
}) => {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <Button
      className={className}
      color={color}
      contentBefore={copied ? <CheckIcon /> : <ContentCopyIcon />}
      onClick={handleClick}
      size={size}
      variant={variant}
    >
      {copied ? labelCopied : label}
    </Button>
  );
};

export default CopyButton;
