import Card from '@/components/card/card';
import SettingsSection from '@/components/inference/settings-section';
import { formatGpuLayouts, gpuRequirementOf, isGpuRequirement } from '@/utils/env-resources';
import { formatGb } from '@/utils/formatters';
import MemoryIcon from '@mui/icons-material/Memory';
import type { TemplateResourceRequirement } from '@oceanprotocol/lib';
import styles from './declared-resources.module.css';

type Column = { label: string; recommended?: number; format: (value: number) => string };

type DeclaredResourcesProps = {
  /** A template's or package's `recommendedResources`. */
  recommended: TemplateResourceRequirement[] | null | undefined;
};

/**
 * The resources a template or package recommends, for the Advanced setup env picker, where the user
 * sizes the launch by hand and the quick start's automatic pick isn't there to do it for them. GPU is
 * total VRAM across the cards. Columns the target doesn't declare are left out; nothing declared at all
 * renders nothing.
 */
const DeclaredResources: React.FC<DeclaredResourcesProps> = ({ recommended }) => {
  const column = (
    label: string,
    match: (r: TemplateResourceRequirement) => boolean,
    format: Column['format']
  ): Column => ({
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
    <Card direction="column" padding="sm" radius="md" shadow="black" spacing="sm" variant="glass">
      <SettingsSection
        description={
          <>
            What it&apos;s tuned for.
            {layouts && ` GPU VRAM is booked as ${layouts}; GPUs that can't hold it aren't offered.`}
          </>
        }
        icon={<MemoryIcon />}
        title="Recommended resources"
      >
        <ul aria-label="Recommended resources" className={styles.list}>
          {columns.map((c) => (
            <li key={c.label}>
              <Card className={styles.chip} direction="column" radius="sm" variant="glass">
                <span className={styles.chipLabel}>{c.label}</span>
                <strong className={styles.chipValue}>
                  {c.recommended === undefined ? '–' : c.format(c.recommended)}
                </strong>
              </Card>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </Card>
  );
};

export default DeclaredResources;
