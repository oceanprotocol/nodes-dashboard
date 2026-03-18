import Button from '@/components/button/button';
import AssistantIcon from '@mui/icons-material/Assistant';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Collapse } from '@mui/material';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import styles from './docs-widget.module.css';

const GitBookFrame = dynamic(() => import('@gitbook/embed/react').then((mod) => mod.GitBookFrame), { ssr: false });

const DocsWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.root}>
      <Collapse className={styles.collapse} in={isOpen}>
        <GitBookFrame className={styles.frame} />
      </Collapse>
      <Button
        color="primary-inverse"
        contentBefore={isOpen ? <KeyboardArrowDownIcon /> : <AssistantIcon />}
        onClick={() => setIsOpen(!isOpen)}
        variant="glass"
      >
        {isOpen ? 'Hide' : 'Docs assistant'}
      </Button>
    </div>
  );
};

export default DocsWidget;
