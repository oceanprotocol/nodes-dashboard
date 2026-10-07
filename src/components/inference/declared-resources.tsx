import { isGpuRequirement } from '@/services/quick-start';
import { DeclaredRequirement } from '@/utils/env-resources';
import { formatGb } from '@/utils/formatters';
import styles from './declared-resources.module.css';

type Column = { label: string; min?: number; recommended?: number; format: (value: number) => string };

type Row = { label: string; value: (column: Column) => number | undefined };

type DeclaredResourcesProps = {
  /** The floors: a template's `requiredResources`, or a package's (which carry `recommended` too). */
  required: DeclaredRequirement[] | null | undefined;
  /** A template's separate recommendation list, when it publishes one. */
  recommended?: DeclaredRequirement[] | null;
};

/**
 * The minimum and recommended resources a template or package declares, for the Advanced setup env
 * picker, where the user sizes the launch by hand and the quick start's automatic pick isn't there to
 * do it for them. Columns and rows the target doesn't declare are left out; nothing declared at all
 * renders nothing.
 */
const DeclaredResources: React.FC<DeclaredResourcesProps> = ({ required, recommended }) => {
  const column = (label: string, match: (r: DeclaredRequirement) => boolean, format: Column['format']): Column => {
    const floor = required?.find(match);
    const recommendation = recommended?.find(match);
    return {
      label,
      min: floor?.min,
      recommended: recommendation?.recommended ?? recommendation?.min ?? floor?.recommended,
      format,
    };
  };
  const columns = [
    column('GPU', isGpuRequirement, (units) => `${units}×`),
    column(
      'CPU',
      (r) => r.id === 'cpu',
      (cores) => `${cores} ${cores === 1 ? 'core' : 'cores'}`
    ),
    column('RAM', (r) => r.id === 'ram', formatGb),
    column('Disk', (r) => r.id === 'disk', formatGb),
  ].filter((c) => c.min !== undefined || c.recommended !== undefined);

  if (columns.length === 0) {
    return null;
  }
  const allRows: Row[] = [
    { label: 'Minimum', value: (c) => c.min },
    { label: 'Recommended', value: (c) => c.recommended },
  ];
  const rows = allRows.filter((row) => columns.some((c) => row.value(c) !== undefined));

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <span className={styles.overline}>What this needs</span>
        <span className={styles.hint}>
          Environments below the minimum can&apos;t run it. The recommended amounts are what it&apos;s tuned for.
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
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {columns.map((c) => {
                  const value = row.value(c);
                  return <td key={c.label}>{value === undefined ? '–' : c.format(value)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeclaredResources;
