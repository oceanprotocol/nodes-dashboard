import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { QuickStart } from '@/components/hooks/use-quick-start';
import { QuickStartButton } from '@/components/inference/quick-start-banner';
import { QuickStartEntry } from '@/services/quick-start';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { CSSProperties, ReactNode, useId, useState } from 'react';
import styles from './details-modal.module.css';

/**
 * The shared building blocks of the package and template details modals, so both read the same way:
 * an identity header, the quick start banner, then titled sections whose boxes, notes and expanders
 * all come from here. One look per meaning: a card is something that opens (DetailsDisclosure, same
 * as a model row), static content sits unboxed, and a DetailsNote is a plain fact line.
 */

type DetailsHeaderProps = {
  /** The tile on the left: a logo, model avatar or category glyph. Wrap plain content in DetailsTile. */
  mark: ReactNode;
  name: string;
  subtitle?: ReactNode;
  chips: ReactNode;
  /** A monospace reference under the chips (image ref, model id). Ellipsized, full value on hover. */
  meta?: string;
  /** Sets `--accent`. Without it the header takes the brand accent. */
  style?: CSSProperties;
};

export const DetailsHeader: React.FC<DetailsHeaderProps> = ({ mark, name, subtitle, chips, meta, style }) => (
  <div className={styles.header} style={style}>
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
      <h4 className={styles.sectionTitle}>{title}</h4>
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
 * The one collapsible in these modals: a card whose row (summary + chevron) opens it in place, with
 * the content under a divider. Same geometry as a model row (inference-model-list), so the package
 * modal's preset and the template modal's disclosures read as one thing.
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

type DetailsActionsProps<T extends QuickStartEntry> = {
  quickStart: QuickStart<T>;
  durationSeconds: number;
  onClose: () => void;
  onAdvanced: () => void;
};

/**
 * Close on the left; Advanced setup and a second Start on the right, for whoever scrolled down. This
 * Start names the session length, since the input setting it is back up in the banner.
 */
export function DetailsActions<T extends QuickStartEntry>({
  quickStart,
  durationSeconds,
  onClose,
  onAdvanced,
}: DetailsActionsProps<T>) {
  return (
    <div className={cx('actionsGroupMdBetween', styles.actions)}>
      <Button color="accent1" onClick={onClose} variant="outlined">
        Close
      </Button>
      <div className="actionsGroupMdEnd">
        <Button color="accent1" contentBefore={<TuneOutlinedIcon />} onClick={onAdvanced} variant="outlined">
          Advanced setup
        </Button>
        <QuickStartButton durationSeconds={durationSeconds} quickStart={quickStart} />
      </div>
    </div>
  );
}
