import { TemplateWorkflow } from '@/types/templates';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import cx from 'classnames';
import { useEffect, useRef, useState } from 'react';
import styles from './template-workflows.module.css';

function useIsClamped(text: string | undefined, expanded: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || expanded) {
      return;
    }
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1);
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
  }, [text, expanded]);

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
  const { ref: bodyRef, clamped } = useIsClamped(workflow.description, expanded);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <AccountTreeOutlinedIcon className={styles.icon} />
        <span className={styles.name}>{workflow.name}</span>
      </div>
      {workflow.description && (
        <>
          <div className={cx(styles.body, { [styles.bodyClamped]: !expanded })} ref={bodyRef}>
            {workflow.description}
          </div>
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
