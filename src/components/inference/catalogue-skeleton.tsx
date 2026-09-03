import { ReactNode } from 'react';
import styles from './catalogue.module.css';

// Widths that make the placeholders read as text rather than as bars: pill widths in px, card lines as
// percentages of the card. Varied per row so the grid doesn't look like a table.
const PILL_WIDTHS = [92, 118, 104, 112, 96, 108];
const CARD_LINES: [string, string][] = [
  ['70%', '80%'],
  ['86%', '58%'],
  ['62%', '74%'],
  ['78%', '66%'],
  ['66%', '84%'],
  ['82%', '60%'],
];

/**
 * Catalogue loading state. Toolbar counts are meaningless before the catalogue lands, so the real
 * header text stays and the controls become shimmering stand-ins, with skeleton cards keeping the
 * grid's rhythm.
 */
const CatalogueSkeleton: React.FC<{ header: ReactNode }> = ({ header }) => (
  <>
    <div className={styles.headerRow}>
      {header}
      <div className={styles.skeletonToolbar}>
        <div className="shimmer" style={{ height: 36, width: 210, borderRadius: 24 }} />
        <div className="shimmer" style={{ height: 36, width: 200, borderRadius: 100 }} />
      </div>
    </div>
    <div className={styles.skeletonPills}>
      {PILL_WIDTHS.map((width) => (
        <div className="shimmer" key={width} style={{ height: 32, width, borderRadius: 100 }} />
      ))}
    </div>
    <div className={styles.grid}>
      {CARD_LINES.map(([first, second]) => (
        <div className={styles.skeletonCard} key={`${first}-${second}`}>
          <div className={styles.skeletonCardTop}>
            <div className="shimmer" style={{ height: 38, width: 38, flex: '0 0 38px', borderRadius: 12 }} />
            <div className={styles.skeletonLines}>
              <div className="shimmer" style={{ height: 12, width: first }} />
              <div className="shimmer shimmerSoft" style={{ height: 9, width: 64 }} />
            </div>
          </div>
          <div className="shimmer shimmerSoft" style={{ height: 9 }} />
          <div className="shimmer shimmerSoft" style={{ height: 9, width: second }} />
          <div className={styles.skeletonChips}>
            <div className="shimmer" style={{ height: 22, width: 58, borderRadius: 16 }} />
            <div className="shimmer shimmerSoft" style={{ height: 22, width: 78, borderRadius: 16 }} />
          </div>
        </div>
      ))}
    </div>
  </>
);

export default CatalogueSkeleton;
