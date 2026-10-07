import { ShowcaseItem } from '@/types/showcase';
import classNames from 'classnames';
import { CSSProperties } from 'react';
import styles from './showcase-row.module.css';
import ShowcaseTile, { ratioOf } from './showcase-tile';

/** A row's items repeat until the row is at least this many tile-heights wide, so the loop never runs short on wide screens. */
const MIN_ROW_LENGTH = 14;
/** Scroll duration per tile-height of row length; keeps the speed in px/s equal across rows of different length. */
const SECONDS_PER_LENGTH = 3.8;
const ROW_SPEEDS = [1, 0.85, 1.15, 0.9];
const ENTER_STAGGER_MS = 140;

export type ShowcaseRowData = {
  tiles: ShowcaseItem[];
  duration: number;
  reverse: boolean;
};

/** Deals items round-robin into rows that alternate direction, each long enough to loop seamlessly. */
export function buildShowcaseRows(items: ShowcaseItem[], rowCount: number): ShowcaseRowData[] {
  const buckets: ShowcaseItem[][] = Array.from({ length: rowCount }, () => []);
  items.forEach((item, index) => {
    buckets[index % rowCount].push(item);
  });
  return buckets
    .filter((bucket) => bucket.length > 0)
    .map((bucket, index) => {
      const length = bucket.reduce((sum, item) => sum + ratioOf(item), 0);
      const repeats = Math.max(1, Math.ceil(MIN_ROW_LENGTH / length));
      return {
        tiles: Array.from({ length: repeats }, () => bucket).flat(),
        duration: (length * repeats * SECONDS_PER_LENGTH) / ROW_SPEEDS[index % ROW_SPEEDS.length],
        reverse: index % 2 === 1,
      };
    });
}

type ShowcaseRowProps = {
  /** Shows each tile's chip. Off where every tile comes from the same template or model. */
  chips?: boolean;
  className?: string;
  /** Position among sibling rows; staggers the entrance. */
  index: number;
  row: ShowcaseRowData;
};

/**
 * One row of mixed-ratio tiles scrolling sideways. It renders its tiles twice and slides by exactly one
 * copy, so the loop is seamless; the second copy is hidden from assistive tech. Tiles take the row's
 * full height, which the parent decides.
 */
const ShowcaseRow = ({ chips = true, className, index, row }: ShowcaseRowProps) => (
  <div
    className={classNames(styles.row, row.reverse && styles.rowReverse, className)}
    style={
      {
        '--duration': `${row.duration.toFixed(1)}s`,
        '--enter-delay': `${index * ENTER_STAGGER_MS}ms`,
      } as CSSProperties
    }
  >
    <div className={styles.track}>
      {[false, true].map((clone) => (
        <div
          aria-hidden={clone || undefined}
          className={classNames(styles.group, clone && styles.groupClone)}
          key={String(clone)}
        >
          {row.tiles.map((item, tileIndex) => (
            <ShowcaseTile chip={chips} inert={clone} item={item} key={`${item.id}-${tileIndex}`} />
          ))}
        </div>
      ))}
    </div>
    <span aria-hidden className={classNames(styles.denoise, styles.denoiseStart)} />
    <span aria-hidden className={styles.denoise} />
  </div>
);

export default ShowcaseRow;
