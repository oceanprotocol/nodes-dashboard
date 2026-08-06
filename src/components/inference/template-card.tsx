import GpuIcon from '@/assets/icons/gpu.svg';
import Card from '@/components/card/card';
import { templateLogoSrc } from '@/components/inference/template-logos';
import {
  CATEGORY_META,
  TemplateCategory,
  templateHardware,
  templateVendor,
  visualFor,
} from '@/components/inference/template-visual';
import { AppTemplate } from '@/types/templates';
import DnsIcon from '@mui/icons-material/Dns';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import cx from 'classnames';
import { CSSProperties } from 'react';
import styles from './template-card.module.css';

/** A template decorated with everything the card renders — all of it derived from the template alone. */
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
  /** Shown instead of the resource meta when the template declares neither RAM nor disk. */
  metaFallback: string | null;
};

export function decorate(tpl: AppTemplate): DecoratedTemplate {
  const visual = visualFor(tpl.id);
  const hw = templateHardware(tpl);
  // Icons match the environment cards: generic GPU glyph for GPU, chip/memory glyph for CPU,
  // SD-storage for RAM, DNS for disk.
  const meta: DecoratedTemplate['meta'] = [
    {
      key: 'hw',
      Icon: hw.gpu ? GpuIcon : MemoryIcon,
      label: hw.gpu ? `${hw.gpuUnits || 1}× GPU` : 'CPU only',
    },
  ];
  if (hw.ram != null) {
    meta.push({ key: 'ram', Icon: SdStorageIcon, label: `${hw.ram} GB RAM` });
  }
  if (hw.disk != null) {
    meta.push({ key: 'disk', Icon: DnsIcon, label: `${hw.disk} GB disk` });
  }
  // No container port here: pre-launch it's not actionable — the reachable host port and URL are only
  // assigned when the service starts, and the manage-service page shows those.
  return {
    tpl,
    category: visual.category,
    accent: visual.meta.accent,
    categoryLabel: visual.meta.label,
    CategoryIcon: visual.meta.Icon,
    mono: visual.mono,
    logo: templateLogoSrc(tpl.id),
    name: tpl.name ?? tpl.id,
    vendor: templateVendor(tpl.image),
    gpu: hw.gpu,
    interaction: visual.meta.interaction,
    meta,
    metaFallback: hw.ram == null && hw.disk == null ? 'Resources at next step' : null,
  };
}

type TemplateCardProps = {
  item: DecoratedTemplate;
  onOpen: (tpl: AppTemplate) => void;
};

/** Catalogue tile for one app template: category-accented, opens the details modal (it never launches). */
const TemplateCard: React.FC<TemplateCardProps> = ({ item, onOpen }) => (
  <Card
    ariaLabel={`Open details for ${item.name}, ${item.categoryLabel}, ${item.gpu ? 'GPU' : 'CPU'}, ${item.interaction}`}
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
      <span className={styles.tile}>
        {item.mono ? (
          <span className={styles.tileMono}>{item.mono}</span>
        ) : (
          <item.CategoryIcon className={styles.tileIcon} />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.logo && <img alt="" className={styles.tileLogo} src={item.logo} />}
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
      <span className={cx('chip', 'chipGlass', styles.chip)}>{item.gpu ? 'GPU' : 'CPU'}</span>
      <span className={cx('chip', 'chipAccent2', styles.chip)}>{item.interaction}</span>
    </div>

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
