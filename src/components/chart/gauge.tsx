import { formatNumber } from '@/utils/formatters';
import Tooltip from '@mui/material/Tooltip';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import styles from './gauge.module.css';

type GaugeProps = {
  centerLabel?: string;
  centerValue?: number;
  label?: string;
  max: number;
  min: number;
  title: string;
  value: number;
  valueSuffix?: string;
};

const Gauge = ({ centerLabel, centerValue, label, max, min, title, value, valueSuffix }: GaugeProps) => {
  const isOverMax = value > max;
  const clampedValue = Math.min(value, max);
  const displayCenterValue = centerValue !== undefined ? centerValue : value;

  const slices = useMemo(() => {
    const offsetValue = clampedValue - min;
    const offsetMax = max - clampedValue;
    return [
      { value: offsetValue, color: 'var(--accent1)' },
      { value: offsetMax, color: 'var(--background-glass)' },
    ];
  }, [max, min, clampedValue]);

  const tooltipContent = isOverMax
    ? `${formatNumber(value)}${valueSuffix || ''}`
    : `${formatNumber(value)}${valueSuffix || ''}`;

  return (
    <div className={styles.root}>
      <h3 className={styles.heading}>{title}</h3>
      <div className={styles.chartWrapper}>
        <Tooltip arrow placement="top" title={tooltipContent}>
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <Pie
                  cy="100%"
                  data={slices}
                  endAngle={0}
                  innerRadius={'140%'}
                  outerRadius={'200%'}
                  startAngle={180}
                  stroke="none"
                >
                  {slices.map((entry, index) => (
                    <Cell fill={entry.color} key={`cell-${index}`} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.valueWrapper}>
              <div className={styles.value}>
                {formatNumber(displayCenterValue)}
                {centerValue === undefined && valueSuffix}
              </div>
              {centerLabel || label ? <div className={styles.label}>{centerLabel || label}</div> : null}
            </div>
          </div>
        </Tooltip>
        <div className={styles.footer}>
          <div>
            {formatNumber(min)}
            {valueSuffix}
          </div>
          <div>
            {formatNumber(max)}
            {valueSuffix}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Gauge;
