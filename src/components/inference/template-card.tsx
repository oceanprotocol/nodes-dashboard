import GpuIcon from '@/assets/icons/gpu.svg';
import Card from '@/components/card/card';
import TemplateIncludes, { includesSummary } from '@/components/inference/template-includes';
import { templateLogoSrc } from '@/components/inference/template-logos';
import { templateHardware, visualFor } from '@/components/inference/template-visual';
import { AppBundle } from '@/types/templates';
import DnsIcon from '@mui/icons-material/Dns';
import MemoryIcon from '@mui/icons-material/Memory';
import cx from 'classnames';
import { CSSProperties } from 'react';
import styles from './template-card.module.css';

/** How many included items a card lists before collapsing the rest into "+N more". */
const VISIBLE_ITEMS = 3;

type TemplateCardProps = {
  bundle: AppBundle;
  /** Parent service's display name, resolved by the page (the parent may not be published here). */
  serviceName: string;
  onOpen: (bundle: AppBundle) => void;
};

/**
 * Catalogue tile for one bundle. Led by the `outcome` — the concrete thing this gets done — because
 * that is what someone browsing bundles is choosing between; the app it runs on is the subtitle, not
 * the headline. Below that, what it brings (publisher avatars + names) and what it needs. Opens the
 * shared details modal; it never launches.
 */
const TemplateCard: React.FC<TemplateCardProps> = ({ bundle, serviceName, onOpen }) => {
  const visual = visualFor(bundle.id, bundle.category);
  const hw = templateHardware(bundle);
  const logo = templateLogoSrc(bundle.service) ?? templateLogoSrc(bundle.id);
  const summary = includesSummary(bundle);
  const headline = bundle.outcome ?? bundle.name ?? bundle.id;

  return (
    <Card
      ariaLabel={`Open details for ${headline}, a ${serviceName} template`}
      className={styles.card}
      direction="column"
      innerShadow="black"
      onClick={() => onOpen(bundle)}
      padding="sm"
      radius="md"
      spacing="sm"
      style={{ '--accent': visual.meta.accent } as CSSProperties}
      variant="glass"
    >
      <div className={styles.cardTop}>
        <span className={styles.tile}>
          {visual.mono ? (
            <span className={styles.tileMono}>{visual.mono}</span>
          ) : (
            <visual.meta.Icon className={styles.tileIcon} />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img alt="" className={styles.tileLogo} src={logo} />}
        </span>
        <span className={styles.titleWrap}>
          <span className={styles.outcome} title={headline}>
            {headline}
          </span>
          <span className={styles.service} title={serviceName}>
            on {serviceName}
          </span>
        </span>
      </div>

      {summary && (
        <div className={styles.included}>
          <span className={styles.includedHead}>{summary} included</span>
          <TemplateIncludes compact max={VISIBLE_ITEMS} template={bundle} />
        </div>
      )}

      <div className={styles.metaRow}>
        <span className={cx('chip', hw.gpu ? 'chipAccent2' : 'chipGlass', styles.chip)}>
          {hw.gpu ? <GpuIcon className={styles.chipIcon} /> : <MemoryIcon className={styles.chipIcon} />}
          {hw.gpu ? `${hw.gpuUnits || 1}× GPU` : 'CPU only'}
        </span>
        {hw.disk != null && (
          <span className={styles.meta}>
            <DnsIcon className={styles.metaIcon} />
            {hw.disk} GB disk
          </span>
        )}
      </div>
    </Card>
  );
};

export default TemplateCard;
