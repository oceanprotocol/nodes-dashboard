import GpuIcon from '@/assets/icons/gpu.svg';
import Card from '@/components/card/card';
import BundleIncludes from '@/components/inference/bundle-includes';
import { templateLogo } from '@/components/inference/template-logos';
import {
  CATEGORY_META,
  TemplateCategory,
  templateHardware,
  templateVendor,
  visualFor,
} from '@/components/inference/template-visual';
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
  accent: string;
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
  included: string | null;
  ariaLabel: string;
};

export function decorate(tpl: AppTemplate): DecoratedTemplate {
  const visual = visualFor(tpl.id, tpl.category);
  const hw = templateHardware(tpl);
  // Icons match the environment cards: generic GPU glyph for GPU, chip/memory glyph for CPU,
  // SD-storage for RAM, DNS for disk.
  const cores = hw.cpu != null ? `${hw.cpu} ${hw.cpu === 1 ? 'core' : 'cores'}` : null;
  const meta: DecoratedTemplate['meta'] = [
    hw.gpu
      ? { key: 'hw', Icon: GpuIcon, label: `${hw.gpuUnits || 1}× GPU` }
      : { key: 'hw', Icon: MemoryIcon, label: cores ? `CPU only · ${cores}` : 'CPU only' },
  ];
  if (hw.gpu && cores) {
    meta.push({ key: 'cpu', Icon: MemoryIcon, label: cores });
  }
  if (hw.ram != null) {
    meta.push({ key: 'ram', Icon: SdStorageIcon, label: `${hw.ram} GB RAM` });
  }
  if (hw.disk != null) {
    meta.push({ key: 'disk', Icon: DnsIcon, label: `${hw.disk} GB disk` });
  }
  const metaFallback = hw.cpu == null && hw.ram == null && hw.disk == null ? 'Resources at next step' : null;
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
const TemplateCard: React.FC<TemplateCardProps> = ({ item, onOpen }) => (
  <Card
    ariaLabel={item.ariaLabel}
    className={styles.card}
    direction="column"
    innerShadow="black"
    onClick={() => onOpen(item.tpl)}
    padding="sm"
    radius="md"
    spacing="sm"
    style={{ '--accent': item.accent } as CSSProperties}
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
      <span className={cx('chip', 'chipGlass', styles.chip)}>{item.categoryLabel}</span>
      <span className={cx('chip', 'chipAccent2', styles.chip)}>{item.interaction}</span>
    </div>

    {item.included && (
      <div className={styles.included}>
        <span className={styles.includedHead}>{item.included} included</span>
        <BundleIncludes compact max={VISIBLE_INCLUDES} template={item.tpl} />
      </div>
    )}

    <div className={styles.metaRow}>
      {item.meta.map(({ key, Icon, label }) => (
        <span className={styles.meta} key={key}>
          <Icon className={styles.metaIcon} />
          {label}
        </span>
      ))}
      {item.metaFallback && <span className={styles.metaFallback}>{item.metaFallback}</span>}
    </div>
  </Card>
);

export default TemplateCard;
