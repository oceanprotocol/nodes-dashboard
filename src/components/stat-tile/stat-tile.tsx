import styles from './stat-tile.module.css';

export type StatTileItem = {
  label: string;
  value: string;
};

type StatTileProps = {
  items: StatTileItem[];
  title: string;
};

/**
 * A small label/value list sized to sit alongside VBarChart and Gauge inside the
 * stats grids.
 *
 * Exists because several services metrics are plain scalars with no natural
 * denominator — "running now", "consumers served" — so a Gauge would need a
 * fabricated `max` to render them, and a bar chart has nothing to plot over time.
 * The row heights mirror VBarChart's `auto 110px` grid so tiles line up with the
 * charts either side of them.
 */
const StatTile: React.FC<StatTileProps> = ({ items, title }) => (
  <div className={styles.root}>
    <h3 className={styles.heading}>{title}</h3>
    <dl className={styles.list}>
      {items.map((item) => (
        <div className={styles.item} key={item.label}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);

export default StatTile;
