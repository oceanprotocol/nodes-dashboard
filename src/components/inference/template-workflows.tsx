import { TemplateWorkflow } from '@/types/templates';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { useEffect, useRef, useState } from 'react';
import styles from './template-workflows.module.css';

/** Three lines of .body — keep in step with its pinned `line-height` in the CSS module. */
const BODY_LINE_HEIGHT = 21;
const CLAMPED_LINES = 3;
const COLLAPSED_HEIGHT = BODY_LINE_HEIGHT * CLAMPED_LINES;

/**
 * Whether the description actually overflows the collapsed height, i.e. whether "Show more" is worth
 * showing at all. Measured on the full, unclamped text (Collapse owns the visible height, so the
 * element itself is never CSS-clamped) and therefore independent of `expanded`: no remeasure on
 * toggle, and no flicker of the button while the transition runs.
 */
function useIsClamped(text: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => setClamped(element.scrollHeight > COLLAPSED_HEIGHT + 1);
    measure();
    // Width changes move where the clamp falls (the modal is responsive).
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    let stale = false;
    document.fonts?.ready.then(() => {
      if (!stale) {
        measure();
      }
    });
    return () => {
      stale = true;
      observer.disconnect();
    };
  }, [text]);

  return { ref, clamped };
}

/**
 * One graph the bundle installs, unboxed: in the details modals a card means "opens". The body is the
 * node's own `description`, unedited. It already says what goes in and what comes out in its first
 * sentence, so it is clamped to three lines with the rest behind "Show more". The supply → output
 * strip is the one thing the schema can't derive; a workflow that declares neither doesn't get it.
 */
const WorkflowItem: React.FC<{ workflow: TemplateWorkflow }> = ({ workflow }) => {
  const [expanded, setExpanded] = useState(false);
  const hasStrip = !!workflow.inputs || !!workflow.output;
  const { ref: bodyRef, clamped } = useIsClamped(workflow.description);

  return (
    <li className={styles.item}>
      <div className={styles.head}>
        <AccountTreeOutlinedIcon className={styles.icon} />
        <span className={styles.name}>{workflow.name}</span>
      </div>
      {workflow.description && (
        <div className={styles.description}>
          {/* collapsedSize rather than a CSS line-clamp: the text stays mounted and measurable either
              way, and Collapse animates between the three-line height and the full one. */}
          <Collapse collapsedSize={clamped ? COLLAPSED_HEIGHT : undefined} in={expanded || !clamped}>
            <div className={styles.body} ref={bodyRef}>
              {workflow.description}
            </div>
          </Collapse>
          {clamped && (
            <button
              aria-expanded={expanded}
              className={styles.moreButton}
              onClick={() => setExpanded((open) => !open)}
              type="button"
            >
              {expanded ? 'Show less' : 'Show more'}
              <ExpandMoreIcon className={cx(styles.moreChevron, { [styles.moreChevronOpen]: expanded })} />
            </button>
          )}
        </div>
      )}
      {hasStrip && (
        <div className={styles.strip}>
          {workflow.inputs && (
            <div className={styles.stripCell}>
              <span className={styles.stripLabel}>You supply</span>
              <span className={styles.stripValue}>{workflow.inputs}</span>
            </div>
          )}
          {workflow.output && (
            <div className={styles.stripCell}>
              <span className={styles.stripLabel}>Each run makes</span>
              <span className={styles.stripValue}>{workflow.output}</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

/**
 * "What you can run": the graphs a bundle ships, as equal peers in declared order. What the bundle can
 * do is the sum of its workflows, which is why they are stacked and all visible rather than tabbed.
 */
const TemplateWorkflows: React.FC<{ workflows: TemplateWorkflow[] }> = ({ workflows }) => (
  <ul className={styles.list}>
    {workflows.map((workflow) => (
      <WorkflowItem key={workflow.id} workflow={workflow} />
    ))}
  </ul>
);

export default TemplateWorkflows;
