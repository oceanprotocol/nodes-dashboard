import Button from '@/components/button/button';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Collapse from '@mui/material/Collapse';
import cx from 'classnames';
import { useId, useState } from 'react';
import styles from './usage-panel.module.css';

export interface UsagePanelShellProps {
  /** Dense variant: tighter grids and a smaller h5 scale (the job modal). */
  compact: boolean;
  /**
   * Start expanded. Default (`false`) opens on the summary — the bars and any warning signals, which
   * answer "is anything saturated, is anything wrong" without the reader scrolling past trends, every
   * GPU device and the throughput counters to find out.
   */
  defaultExpanded?: boolean;
  /** Everything behind "More info". Its first child should be the `<h5>` the CSS pulls up. */
  details: React.ReactNode;
  /** "Updated 4s ago" — each panel words its own, because a finished container says "Last update". */
  freshness: string;
  /** Exceptional-condition chips, hoisted above the readings. Falsy renders no row at all. */
  signals?: React.ReactNode;
  /** The collapsed view: bars only. */
  summary: React.ReactNode;
  /**
   * The panel's heading, passed as JSX so each call site picks the element its own document outline
   * needs (an `h3` on a page, a `strong` inside a modal). Rendered on the same line as the expand
   * toggle, with the freshness line beneath it.
   */
  title?: React.ReactNode;
}

/**
 * Chrome shared by every usage panel: heading + freshness + the expand toggle, an optional chips row,
 * and the two mutually exclusive Collapse regions. Extracted so the tuned collapse behaviour (and the
 * double-gap fix the `regions` wrapper exists for) has exactly one definition instead of one per panel.
 */
const UsagePanelShell: React.FC<UsagePanelShellProps> = ({
  compact,
  defaultExpanded = false,
  details,
  freshness,
  signals,
  summary,
  title,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const detailsId = useId();

  return (
    <div className={cx(styles.root, { [styles.compactRoot]: compact })}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          {title}
          <div className={cx('textSecondary', styles.freshness)}>{freshness}</div>
        </div>
        <Button
          aria-controls={detailsId}
          aria-expanded={expanded}
          className={styles.toggle}
          color="accent2"
          contentAfter={<ExpandMoreIcon className={cx(styles.toggleIcon, { [styles.toggleIconOpen]: expanded })} />}
          onClick={() => setExpanded((open) => !open)}
          size="sm"
          variant="filled"
        >
          {expanded ? 'Less info' : 'More info'}
        </Button>
      </div>

      {signals ? <div className={styles.signalsRow}>{signals}</div> : null}

      {/* Both regions share one wrapper: a collapsed Collapse still occupies a flex slot at height 0,
          so leaving them as siblings of the header applied the root's `gap` twice. */}
      <div className={styles.regions}>
        <Collapse in={!expanded} mountOnEnter>
          {summary}
        </Collapse>

        <Collapse id={detailsId} in={expanded} mountOnEnter>
          <div className={styles.details}>{details}</div>
        </Collapse>
      </div>
    </div>
  );
};

export default UsagePanelShell;
