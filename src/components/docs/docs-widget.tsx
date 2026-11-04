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
  const [hasOpened, setHasOpened] = useState(false);

  const toggle = () => {
    setIsOpen(!isOpen);
    setHasOpened(true);
  };

  // Mounted on first open, not on page load: the GitBook iframe grabs focus when it loads, and
  // HeadlessUI closes Privy's modal on focus moving into an iframe. On the Google OAuth return
  // that closed the "Logging in" screen before Privy created the embedded wallet (#679).
  return (
    <div className={styles.root}>
      <Collapse className={styles.collapse} in={isOpen}>
        {hasOpened && <GitBookFrame className={styles.frame} />}
      </Collapse>
      <Button
        color="primary-inverse"
        contentBefore={isOpen ? <KeyboardArrowDownIcon /> : <AssistantIcon />}
        onClick={toggle}
        variant="glass"
      >
        {isOpen ? 'Hide' : 'Docs assistant'}
      </Button>
    </div>
  );
};

export default DocsWidget;
