import Button from '@/components/button/button';
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
      {/* {isOpen ? <GitBookFrame className={styles.frame} /> : null} */}
      <Button color="primary-inverse" onClick={() => setIsOpen(!isOpen)} variant="glass">
        Docs
      </Button>
    </div>
  );
};

export default DocsWidget;
