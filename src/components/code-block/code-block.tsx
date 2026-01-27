import CopyButton from '@/components/button/copy-button';
import styles from './code-block.module.css';

type CodeBlockProps = {
  code: string;
};

export const CodeBlock = ({ code }: CodeBlockProps) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className={styles.root}>
      <div>{code}</div>
      <CopyButton color="accent1" contentToCopy={code} variant="outlined" />
    </div>
  );
};
