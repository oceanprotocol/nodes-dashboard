import { TemplateWorkflow } from '@/types/templates';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { Collapse } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import styles from './template-workflows.module.css';

/** Three lines of .body — keep in step with its pinned `line-height` in the CSS module. */
const BODY_LINE_HEIGHT = 20;
const CLAMPED_LINES = 3;
const COLLAPSED_HEIGHT = BODY_LINE_HEIGHT * CLAMPED_LINES;

/**
 * Whether the description actually overflows the collapsed height, i.e. whether "More" is worth
 * showing at all. Measured on the full, unclamped text (Collapse owns the visible height now, so the
 * element itself is never CSS-clamped) and therefore independent of `expanded` — no remeasure on
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
 * One graph the bundle installs. The body is the node's own `description`, unedited — it already says
 * what goes in and what comes out in its first sentence, so it is clamped to three lines with the rest
 * behind "More" rather than rewritten. The supply → output strip is the one thing the schema can't
 * derive; a workflow that declares neither simply doesn't get it.
 */
const WorkflowCard: React.FC<{ workflow: TemplateWorkflow }> = ({ workflow }) => {
  const [expanded, setExpanded] = useState(false);
  const hasStrip = !!workflow.inputs || !!workflow.output;
  const { ref: bodyRef, clamped } = useIsClamped(workflow.description);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <AccountTreeOutlinedIcon className={styles.icon} />
        <span className={styles.name}>{workflow.name}</span>
      </div>
      {workflow.description && (
        <>
          {/* collapsedSize rather than a CSS line-clamp: the text stays mounted and measurable either
              way, and Collapse animates between the three-line height and the full one. `clamped`
              only decides whether the toggle is offered — a description that fits is never wrapped in
              a collapsed state it can't be opened out of. */}
          <Collapse collapsedSize={clamped ? COLLAPSED_HEIGHT : undefined} in={expanded || !clamped}>
            <div className={styles.body} ref={bodyRef}>
              {workflow.description}
            </div>
          </Collapse>
          {clamped && (
            <button className={styles.moreButton} onClick={() => setExpanded((open) => !open)} type="button">
              {expanded ? 'Less' : 'More'}
            </button>
          )}
        </>
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
    </div>
  );
};

/**
 * "What you can run" — the graphs a bundle ships, one card each, as equal peers in declared order.
 * This is the recipe, so it takes the biggest share of the modal: what the bundle can do is the sum of
 * its workflows, which is why they are stacked and all visible rather than tabbed behind a click.
 */
const TemplateWorkflows: React.FC<{ workflows: TemplateWorkflow[] }> = ({ workflows }) => (
  <div className={styles.list}>
    {workflows.map((workflow) => (
      <WorkflowCard key={workflow.id} workflow={workflow} />
    ))}
  </div>
);

export default TemplateWorkflows;
