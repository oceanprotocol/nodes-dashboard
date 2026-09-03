import GpuIcon from '@/assets/icons/gpu.svg';
import Card from '@/components/card/card';
import BundleIncludes from '@/components/inference/bundle-includes';
import { templateLogo } from '@/components/inference/template-logos';
import {
  accentVars,
  CATEGORY_META,
  TemplateCategory,
  TemplateCategoryMeta,
  templateGpuLabel,
  templateHardware,
  templateVendor,
  visualFor,
} from '@/components/inference/template-visual';
import { useTheme } from '@/lib/use-theme';
import { AppTemplate, includesSummary } from '@/types/templates';
import DnsIcon from '@mui/icons-material/Dns';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import cx from 'classnames';
import { CSSProperties } from 'react';
import styles from './template-card.module.css';

/** A catalogue entry decorated with everything the card renders — all derived from the template alone. */
export type DecoratedTemplate = {
  tpl: AppTemplate;
  category: TemplateCategory;
  /** Both theme variants; the renderer resolves one via `accentVars` using the active theme. */
  accent: TemplateCategoryMeta['accent'];
  categoryLabel: string;
  CategoryIcon: (typeof CATEGORY_META)[TemplateCategory]['Icon'];
  mono: string | null;
  logo: string | null;
  name: string;
  vendor: string;
  gpu: boolean;
  /** How the running app is used — "Web UI" / "API" / "Endpoint". See TemplateCategoryMeta.interaction. */
  interaction: string;
  meta: { key: string; Icon: React.ComponentType<{ className?: string }>; label: string }[];
  metaFallback: string | null;
  /** The GPU ask, as the chip row's trailing chip: "2-4 GPUs", "1 GPU", or "CPU only". */
  gpuLabel: string;
  included: string | null;
  ariaLabel: string;
};

export function decorate(tpl: AppTemplate): DecoratedTemplate {
  const visual = visualFor(tpl.id, tpl.category);
  const hw = templateHardware(tpl);
  // Icons match the environment cards: generic GPU glyph for GPU, chip/memory glyph for CPU,
  // SD-storage for RAM, DNS for disk.
  const cores = hw.cpu != null ? `${hw.cpu} ${hw.cpu === 1 ? 'core' : 'cores'}` : null;
  // The card's hardware line is the GPU ask ALONE — the declared range ("2-4 GPUs", or "1 GPU" when
  // min and recommended agree), or "CPU only" when the template declares no GPU. The CPU/RAM/disk
  // figures that used to sit beside it are deliberately gone: the shared slice is now derived from
  // whichever GPU count the user picks (templateFloorSizing — proportional above the declared floor),
  // so printing one fixed cores/RAM/disk triple here stated a number the launch would rarely book.
  // The environment cards show the real amounts per pick, which is where the decision is actually made.
  const gpuChipLabel = templateGpuLabel(hw);
  const meta: DecoratedTemplate['meta'] = [{ key: 'hw', Icon: hw.gpu ? GpuIcon : MemoryIcon, label: gpuChipLabel }];
  // Kept for the aria label / spoken summary below, and so a template that declares nothing still says
  // so rather than rendering an empty meta row.
  const metaFallback = !hw.gpu && hw.cpu == null && hw.ram == null && hw.disk == null ? 'Resources at next step' : null;
  const name = tpl.name ?? tpl.id;
  const included = includesSummary(tpl);
  const spoken = [
    visual.meta.label,
    visual.meta.interaction,
    ...meta.map((m) => m.label.replace(/ · /g, ', ')),
    metaFallback,
    included && `${included} included`,
  ].filter(Boolean);
  // No container port here: pre-launch it's not actionable — the reachable host port and URL are only
  // assigned when the service starts, and the manage-service page shows those.
  return {
    tpl,
    category: visual.category,
    accent: visual.meta.accent,
    categoryLabel: visual.meta.label,
    CategoryIcon: visual.meta.Icon,
    mono: visual.mono,
    logo: templateLogo(tpl),
    name,
    vendor: templateVendor(tpl.image),
    gpu: hw.gpu,
    interaction: visual.meta.interaction,
    meta,
    metaFallback,
    gpuLabel: gpuChipLabel,
    included,
    ariaLabel: `Open details for ${name}. ${spoken.join(', ')}.`,
  };
}

type TemplateCardProps = {
  item: DecoratedTemplate;
  onOpen: (tpl: AppTemplate) => void;
};

/** How many included items a card lists before collapsing the rest into "+N more". */
const VISIBLE_INCLUDES = 3;

/**
 * Catalogue tile for one entry, used by BOTH catalogues: category-accented, opens the details modal
 * (it never launches). A bundle renders one extra block listing the models it brings; a bare service
 * has nothing to list, so the same card covers both and the two pages read as one system.
 */
const TemplateCard: React.FC<TemplateCardProps> = ({ item, onOpen }) => {
  const { resolvedTheme } = useTheme();

  return (
    <Card
      ariaLabel={item.ariaLabel}
      className={styles.card}
      direction="column"
      innerShadow="black"
      onClick={() => onOpen(item.tpl)}
      padding="sm"
      radius="md"
      spacing="sm"
      style={accentVars(item.accent, resolvedTheme) as CSSProperties}
      variant="glass"
    >
      <div className={styles.cardTop}>
        {/* The brand mark REPLACES the category glyph rather than covering it — the marks are
          transparent artwork, so anything drawn underneath shows through the shape. */}
        <span className={styles.tile}>
          {item.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className={styles.tileLogo} src={item.logo} />
          ) : item.mono ? (
            <span className={styles.tileMono}>{item.mono}</span>
          ) : (
            <item.CategoryIcon className={styles.tileIcon} />
          )}
        </span>
        <span className={styles.titleWrap}>
          <span className={styles.name} title={item.name}>
            {item.name}
          </span>
          <span className={styles.vendor} title={item.tpl.image}>
            {item.vendor}
          </span>
        </span>
      </div>

      <p className={cx(styles.desc, { [styles.descEmpty]: !item.tpl.description })}>
        {item.tpl.description || 'No description published for this image.'}
      </p>

      <div className={cx(styles.chips, 'gapSm')}>
        <span className={cx('chip', styles.chip, styles.categoryChip)}>{item.categoryLabel}</span>
        <span className={cx('chip', 'chipAccent2', styles.chip)}>{item.interaction}</span>
        {/* Trailing chip: the GPU ask only. Replaces the old cores/RAM/disk meta row (commented out
            below) — the shared slice now scales with the GPU count the user picks, so a fixed triple
            here named amounts the launch would rarely book. */}
        <span className={cx('chip', 'chipGlass', styles.chip)}>
          {item.gpu ? (
            <GpuIcon className={styles.chipIcon} />
          ) : (
            <MemoryIcon className={styles.chipIcon} fontSize="small" />
          )}
          {item.gpuLabel}
        </span>
      </div>

      {item.included && (
        <div className={styles.included}>
          <span className={styles.includedHead}>{item.included} included</span>
          <BundleIncludes compact max={VISIBLE_INCLUDES} template={item.tpl} />
        </div>
      )}

      {/* Resource meta row (cores / RAM / disk) — commented out in favour of the GPU chip above. The
          numbers were the template's fixed `recommended` figures, which stopped matching what a launch
          books once the shared slice became proportional to the GPU pick (templateFloorSizing). Kept
          rather than deleted: `item.meta`/`metaFallback` still feed the card's aria-label, and this is
          the markup to restore if per-card resource figures are wanted again.
      <div className={styles.metaRow}>
        {item.meta.map(({ key, Icon, label }) => (
          <span className={styles.meta} key={key}>
            <Icon className={styles.metaIcon} />
            {label}
          </span>
        ))}
        {item.metaFallback && <span className={styles.metaFallback}>{item.metaFallback}</span>}
      </div>
      */}
    </Card>
  );
};

export default TemplateCard;
