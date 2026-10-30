import { DeclaredRequirement, formatGpuLayouts, gpuRequirementOf, isGpuRequirement } from '@/utils/env-resources';
import { formatGb } from '@/utils/formatters';
import styles from './declared-resources.module.css';

type Column = { label: string; recommended?: number; format: (value: number) => string };

type DeclaredResourcesProps = {
  /** A template's or package's `recommendedResources`. */
  recommended: DeclaredRequirement[] | null | undefined;
};

/**
 * The resources a template or package recommends, for the Advanced setup env picker, where the user
 * sizes the launch by hand and the quick start's automatic pick isn't there to do it for them. GPU is
 * total VRAM across the cards. Columns the target doesn't declare are left out; nothing declared at all
 * renders nothing.
 */
const DeclaredResources: React.FC<DeclaredResourcesProps> = ({ recommended }) => {
  const column = (label: string, match: (r: DeclaredRequirement) => boolean, format: Column['format']): Column => ({
    label,
    recommended: recommended?.find(match)?.recommended,
    format,
  });
  const columns = [
    column('GPU VRAM', isGpuRequirement, formatGb),
    column(
      'CPU',
      (r) => 'id' in r && r.id === 'cpu',
      (cores) => `${cores} ${cores === 1 ? 'core' : 'cores'}`
    ),
    column('RAM', (r) => 'id' in r && r.id === 'ram', formatGb),
    column('Disk', (r) => 'id' in r && r.id === 'disk', formatGb),
  ].filter((c) => c.recommended !== undefined);

  if (columns.length === 0) {
    return null;
  }
  const gpu = gpuRequirementOf(recommended);
  const layouts = gpu ? formatGpuLayouts(gpu) : '';

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <span className={styles.overline}>What this needs</span>
        <span className={styles.hint}>
          What it&apos;s tuned for.
          {layouts && ` GPU VRAM is booked as ${layouts}; GPUs that can't hold it aren't offered.`}
        </span>
      </div>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <td />
              {columns.map((c) => (
                <th key={c.label} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Recommended</th>
              {columns.map((c) => (
                <td key={c.label}>{c.recommended === undefined ? '–' : c.format(c.recommended)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeclaredResources;
