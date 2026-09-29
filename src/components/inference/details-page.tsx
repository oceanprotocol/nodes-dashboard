import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { CSSProperties, ReactNode, useId, useState } from 'react';
import catalogueStyles from './catalogue.module.css';
import styles from './details-page.module.css';

/**
 * The shared building blocks of the package and template details pages, so both read the same way:
 * an identity card with the way back, the quick start banner under it (Start, and the Advanced setup
 * link), then a card of titled sections whose boxes, notes and expanders all come from here. One look
 * per meaning: a card is something that opens (DetailsDisclosure, same as a model row), static content
 * sits unboxed, and a DetailsNote is a plain fact line.
 */

// The catalogue URL, filters included, the latest details page was opened from, so Back lands on the
// same filtered grid. Module state: it survives client-side navigation and resets on a full load,
// where there is no such grid to return to.
let openedFromUrl: string | null = null;

/** Called by a catalogue as it opens an entry's details page, with its own current URL. */
export const rememberCatalogueUrl = (url: string) => {
  openedFromUrl = url;
};

/** Back's target: the catalogue as it was left when it opened this page, else its bare path. */
const catalogueBackHref = (pathname: string): string =>
  openedFromUrl?.split('?')[0] === pathname ? openedFromUrl : pathname;

/** The page frame: the flow's title and stepper. */
export const DetailsPage: React.FC<{ subTitle: string; stepper: ReactNode; children: ReactNode }> = ({
  subTitle,
  stepper,
  children,
}) => (
  <Container className="pageRoot">
    <SectionTitle contentBetween={stepper} moreReadable subTitle={subTitle} title="Inference" />
    <div className="pageContentWrapper">{children}</div>
  </Container>
);

type DetailsLayoutProps = {
  /** The catalogue the entry is listed on, which Back returns to. */
  back: { pathname: string; label: string };
  header: ReactNode;
  /** The quick start banner. */
  launch: ReactNode;
  /** The sections. */
  children: ReactNode;
  /** Sets `--accent` for everything inside. Without it the page takes the brand accent. */
  style?: CSSProperties;
};

export const DetailsLayout: React.FC<DetailsLayoutProps> = ({ back, header, launch, children, style }) => (
  <div className={styles.layout} style={style}>
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="sm" variant="glass-shaded">
      <div>
        <Button
          className={styles.back}
          color="accent1"
          contentBefore={<ArrowBackIcon />}
          href={catalogueBackHref(back.pathname)}
          size="sm"
          variant="transparent"
        >
          {back.label}
        </Button>
      </div>
      {header}
    </Card>
    {launch}
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      {children}
    </Card>
  </div>
);

/** The layout's shape while the catalogue loads, so nothing jumps when the entry arrives. */
export const DetailsSkeleton: React.FC = () => (
  <div aria-busy="true" aria-label="Loading details" className={styles.layout}>
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="sm" variant="glass-shaded">
      <div className="shimmer shimmerSoft" style={{ height: 20, width: 140, borderRadius: 6 }} />
      <div className={styles.header}>
        <span className={cx('shimmer', styles.tile)} />
        <div className={styles.headerText}>
          <div className="shimmer" style={{ height: 30, width: '45%', borderRadius: 8 }} />
          <div className="shimmer shimmerSoft" style={{ height: 14, width: '70%' }} />
          <div className="shimmer shimmerSoft" style={{ height: 22, width: 200, maxWidth: '100%', borderRadius: 16 }} />
        </div>
      </div>
    </Card>
    <div className="shimmer" style={{ height: 150, borderRadius: 16 }} />
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="sm" variant="glass-shaded">
      <div className="shimmer" style={{ height: 18, width: 120, borderRadius: 6 }} />
      <div className="shimmer shimmerSoft" style={{ height: 13, width: '100%' }} />
      <div className="shimmer shimmerSoft" style={{ height: 13, width: '92%' }} />
      <div className="shimmer shimmerSoft" style={{ height: 13, width: '60%' }} />
    </Card>
  </div>
);

type DetailsMissingProps = {
  title: string;
  children: ReactNode;
  /** Where to go instead: the catalogue the entry would have been on. */
  action: { href: string; label: string };
};

/** A link to an entry the catalogue doesn't list (renamed, withdrawn, mistyped), or a failed load. */
export const DetailsMissing: React.FC<DetailsMissingProps> = ({ title, children, action }) => (
  <div className={catalogueStyles.emptyState}>
    <SearchOffIcon className={catalogueStyles.emptyIcon} />
    <div className={catalogueStyles.emptyTitle}>{title}</div>
    <div className={catalogueStyles.emptyHint}>{children}</div>
    <Button className={catalogueStyles.emptyReset} color="accent1" href={action.href} size="sm">
      {action.label}
    </Button>
  </div>
);

type DetailsHeaderProps = {
  /** The tile on the left: a logo, model avatar or category glyph. Wrap plain content in DetailsTile. */
  mark: ReactNode;
  name: string;
  subtitle?: ReactNode;
  chips: ReactNode;
  /** A monospace reference under the chips (image ref, model id). Ellipsized, full value on hover. */
  meta?: string;
};

export const DetailsHeader: React.FC<DetailsHeaderProps> = ({ mark, name, subtitle, chips, meta }) => (
  <div className={styles.header}>
    {mark}
    <div className={styles.headerText}>
      <h2 className={styles.name}>{name}</h2>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      <div className={styles.chips}>{chips}</div>
      {meta && (
        <div className={styles.meta} title={meta}>
          {meta}
        </div>
      )}
    </div>
  </div>
);

/** The header's square tile. `image` drops the accent tint, for artwork that fills the tile. */
export const DetailsTile: React.FC<{ children: ReactNode; image?: boolean }> = ({ children, image = false }) => (
  <span className={cx(styles.tile, { [styles.tileImage]: image })}>{children}</span>
);

type ChipTone = 'accent' | 'glass' | 'quiet';

/** Header chip. `accent` carries the category, `glass` a spec, `quiet` a classification. */
export const DetailsChip: React.FC<{ children: ReactNode; tone?: ChipTone; className?: string }> = ({
  children,
  tone = 'glass',
  className,
}) => (
  <span
    className={cx(
      'chip',
      styles.chip,
      {
        chipGlass: tone === 'glass',
        [styles.chipAccent]: tone === 'accent',
        [styles.chipQuiet]: tone === 'quiet',
      },
      className
    )}
  >
    {children}
  </span>
);

type DetailsSectionProps = {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
};

export const DetailsSection: React.FC<DetailsSectionProps> = ({ title, hint, children }) => (
  <section className={styles.section}>
    <div className={styles.sectionHead}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {hint && <div className={styles.sectionHint}>{hint}</div>}
    </div>
    {children}
  </section>
);

type DetailsNoteProps = {
  Icon: React.ComponentType<{ className?: string }>;
  title?: string;
  children: ReactNode;
};

/** A plain fact line with an icon, not a box: a stated absence, or how the running app is reached. */
export const DetailsNote: React.FC<DetailsNoteProps> = ({ Icon, title, children }) => (
  <div className={styles.note}>
    <Icon className={styles.noteIcon} />
    <div>
      {title && <strong>{title}</strong>} {children}
    </div>
  </div>
);

type DetailsDisclosureProps = {
  summary: ReactNode;
  children: ReactNode;
};

/**
 * The one collapsible on these pages: a card whose row (summary + chevron) opens it in place, with
 * the content under a divider. Same geometry as a model row (inference-model-list), so the package
 * page's preset and the template page's disclosures read as one thing.
 */
export const DetailsDisclosure: React.FC<DetailsDisclosureProps> = ({ summary, children }) => {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <Card direction="column" innerShadow="black" radius="sm" variant="glass">
      <button
        aria-controls={contentId}
        aria-expanded={open}
        className={styles.disclosureRow}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        type="button"
      >
        <span className={styles.disclosureSummary}>{summary}</span>
        <ExpandMoreIcon className={cx(styles.chevron, { [styles.chevronOpen]: open })} fontSize="small" />
      </button>
      {/* Mounted only once opened, so the manifest's avatar images don't load for a closed card. */}
      <Collapse in={open} mountOnEnter unmountOnExit>
        <div className={styles.disclosureContent} id={contentId}>
          {children}
        </div>
      </Collapse>
    </Card>
  );
};

/** The disclosure summary's leading glyph, sized like a model row's avatar. */
export const DetailsDisclosureIcon: React.FC<{ Icon: React.ComponentType<{ className?: string }> }> = ({ Icon }) => (
  <span className={styles.disclosureIcon}>
    <Icon />
  </span>
);

/** The disclosure summary's text: a title, and a secondary line under it, like a model row's name and id. */
export const DetailsDisclosureLabel: React.FC<{ title: ReactNode; sub?: ReactNode }> = ({ title, sub }) => (
  <span className={styles.disclosureLabel}>
    <span className={styles.disclosureTitle}>{title}</span>
    {sub && <span className={styles.disclosureSub}>{sub}</span>}
  </span>
);
