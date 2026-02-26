import CopyButton from '@/components/button/copy-button';
import styles from './code-block.module.css';

type CodeBlockProps = {
  code: string;
};

export const CodeBlock = ({ code }: CodeBlockProps) => {
  return (
    <div className={styles.root}>
      <div>{code}</div>
      <CopyButton color="accent2" contentToCopy={code} variant="filled" />
    </div>
  );
};
