import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import styles from './h-bar-chart.module.css';

type HBarChartProps = {
  axisKey: string;
  barKey: string;
  data: any[];
  /**
   * Trim category labels to this many characters, revealing the full value on
   * hover. Omit to render labels in full (the default, so existing charts are
   * unaffected).
   */
  maxLabelChars?: number;
};

const BAR_HEIGHT = 52;
const AXIS_WIDTH = 120;
/* Ticks inherit the 14px body font, where 8px/char is a safe over-estimate for
   this typeface. The gutter must not be undersized: labels are anchored to the
   axis and grow leftwards, so anything too long for `width` is clipped by the
   SVG viewport rather than wrapped. */
const LABEL_CHAR_WIDTH = 8;

/* Leading, not trailing, ellipsis. Model ids and container images are namespaced,
   so it is the tail that tells them apart — `Qwen/Qwen3-Coder-Next` and
   `Qwen/Qwen3-Coder-30B-A3B-Instruct` share their first 17 characters, and five of
   the ten most-used images start with a registry host. */
const truncateTail = (value: string, maxChars: number) =>
  value.length > maxChars ? `…${value.slice(-(maxChars - 1))}` : value;

/* A custom tick because the value has to survive twice: truncated as the visible
   label, and in full inside an SVG <title>, which browsers render as a native
   hover tooltip. HBarChart has no Recharts <Tooltip>, so <title> is the only
   hover surface available. */
const TruncatedTick = ({ x, y, payload, maxChars }: any) => {
  const full = String(payload?.value ?? '');
  const label = truncateTail(full, maxChars);

  return (
    <text className="recharts-text" dy={4} fill="var(--text-primary)" textAnchor="end" x={x} y={y}>
      {label !== full && <title>{full}</title>}
      {label}
    </text>
  );
};

const HBarChart = ({ axisKey, barKey, data, maxLabelChars }: HBarChartProps) => (
  <div className={styles.root}>
    <ResponsiveContainer width="100%" height={data.length * BAR_HEIGHT}>
      <BarChart data={data} layout="vertical">
        <XAxis
          axisLine={false}
          dataKey={barKey}
          tick={{ fill: 'var(--text-secondary)' }}
          tickLine={false}
          type="number"
          allowDecimals={false}
        />
        <YAxis
          axisLine={false}
          dataKey={axisKey}
          stroke="var(--border)"
          tick={maxLabelChars ? <TruncatedTick maxChars={maxLabelChars} /> : { fill: 'var(--text-primary)' }}
          tickLine={false}
          type="category"
          allowDecimals={false}
          width={maxLabelChars ? maxLabelChars * LABEL_CHAR_WIDTH + 8 : AXIS_WIDTH}
        />
        <Bar barSize={30} dataKey={barKey} fill="var(--accent1)" radius={[4, 8, 8, 4]} />
        <CartesianGrid horizontal={true} stroke="var(--border)" vertical={false} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default HBarChart;
