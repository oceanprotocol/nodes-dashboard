import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { ReactNode, useId, useState } from 'react';
import styles from './template-disclosure.module.css';

type TemplateDisclosureProps = {
  summary: ReactNode;
  Icon?: React.ComponentType<{ className?: string }>;
  openLabel?: string;
  closeLabel?: string;
  raised?: boolean;
  contentIsPanel?: boolean;
  children: ReactNode;
};

const TemplateDisclosure: React.FC<TemplateDisclosureProps> = ({
  summary,
  Icon,
  openLabel = 'Details',
  closeLabel = 'Hide details',
  raised = false,
  contentIsPanel = false,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className={styles.wrapper}>
      <button
        aria-controls={contentId}
        aria-expanded={open}
        className={cx(styles.row, { [styles.rowRaised]: raised })}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        type="button"
      >
        {Icon && <Icon className={styles.icon} />}
        <span className={styles.summary}>{summary}</span>
        <span className={styles.toggle}>
          {open ? closeLabel : openLabel}
          <ExpandMoreIcon className={cx(styles.chevron, { [styles.chevronOpen]: open })} />
        </span>
      </button>
      {/* mountOnEnter/unmountOnExit keeps the old `{open && …}` semantics — the manifest's avatar
          images and the env-var chips only ever mount once the row is actually opened — while the
          height transition replaces the instant swap. */}
      <Collapse in={open} mountOnEnter unmountOnExit>
        <div className={cx(styles.content, { [styles.contentPanel]: contentIsPanel })} id={contentId}>
          {children}
        </div>
      </Collapse>
    </div>
  );
};

export default TemplateDisclosure;
