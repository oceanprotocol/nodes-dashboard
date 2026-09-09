import { Tooltip } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import EntityTick, { EntityKind } from './entity-tick';
import styles from './h-bar-chart.module.css';

type HBarChartProps = {
  axisKey: string;
  barKey: string;
  data: any[];
  /**
   * Trim category labels to this many characters, revealing the full value on
   * hover. Omit to render labels in full (the default, so existing charts are
   * unaffected). Ignored when `entityKind` is set — a rich label clamps its own
   * two lines to the gutter width instead.
   */
  maxLabelChars?: number;
  /**
   * Render category labels as avatar + name cards rather than plain text, the
   * way models and apps are shown in the services table. `model` reads the axis
   * value as a Hugging Face model id, `app` as a container image (see
   * EntityTick). Omit for non-entity axes (epochs, GPU names).
   */
  entityKind?: EntityKind;
};

const BAR_HEIGHT = 52;
const AXIS_WIDTH = 120;
/* A rich label needs room for an avatar plus a two-line name, so it gets a wider gutter than the
   plain text tick's character-counted one. */
const ENTITY_AXIS_WIDTH = 210;
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
   label, and in full on hover. The hover surface is a MUI Tooltip rather than an
   SVG <title> so it matches EntityTick and the rest of the app's tooltips — a
   native <title> has its own delay and styling and reads as a browser chrome
   popup. HBarChart has no Recharts <Tooltip>, so the tick owns the hover itself. */
const TruncatedTick = ({ x, y, payload, maxChars }: any) => {
  const full = String(payload?.value ?? '');
  const label = truncateTail(full, maxChars);

  return (
    <Tooltip followCursor title={label !== full ? full : ''}>
      <text className="recharts-text" dy={4} fill="var(--text-primary)" textAnchor="end" x={x} y={y}>
        {label}
      </text>
    </Tooltip>
  );
};

/* Bars carry the same hover text as their label, so a row is identifiable from either end of it —
   the bar is the larger target, and on a chart whose gutter is truncated (`maxLabelChars`) or
   clamped (`entityKind`) it is often the only place the full name can be read. Recharts' own
   <Tooltip> is deliberately not used: it would need a different payload shape per chart and would
   look nothing like the MUI tooltips the rest of the app uses.

   Wrapping the shape rather than the whole <Bar> because a Bar renders one <Rectangle> per row, and
   the tooltip has to anchor to the hovered row. Rectangle (not a hand-rolled <rect>) so the bar's
   `radius` still applies, inside a <g> because MUI Tooltip attaches its ref and mouse handlers to
   its immediate child and Rectangle is a class component that would swallow them. */
const TooltipBarShape = ({ axisKey, ...props }: any) => {
  const full = String(props?.payload?.[axisKey] ?? '');

  return (
    <Tooltip followCursor title={full}>
      <g>
        <Rectangle {...props} />
      </g>
    </Tooltip>
  );
};

const HBarChart = ({ axisKey, barKey, data, maxLabelChars, entityKind }: HBarChartProps) => {
  const axisWidth = entityKind ? ENTITY_AXIS_WIDTH : maxLabelChars ? maxLabelChars * LABEL_CHAR_WIDTH + 8 : AXIS_WIDTH;
  // A rich label carries its own avatar and two lines of text, so it outranks the plain truncating
  // tick when both are configured.
  const tick = entityKind ? (
    <EntityTick kind={entityKind} width={axisWidth} />
  ) : maxLabelChars ? (
    <TruncatedTick maxChars={maxLabelChars} />
  ) : (
    { fill: 'var(--text-primary)' }
  );

  return (
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
            tick={tick}
            tickLine={false}
            type="category"
            allowDecimals={false}
            width={axisWidth}
          />
          <Bar
            barSize={30}
            dataKey={barKey}
            fill="var(--accent1)"
            radius={[4, 8, 8, 4]}
            shape={<TooltipBarShape axisKey={axisKey} />}
          />
          <CartesianGrid horizontal={true} stroke="var(--border)" vertical={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HBarChart;
