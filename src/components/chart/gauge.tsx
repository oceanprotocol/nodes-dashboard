import { formatNumber } from '@/utils/formatters';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import styles from './gauge.module.css';

type GaugeProps = {
  label?: string;
  max: number;
  min: number;
  title: string;
  value: number;
};

const Gauge = ({ label, max, min, title, value }: GaugeProps) => {
  const slices = useMemo(() => {
    const offsetValue = value - min;
    const offsetMax = max - offsetValue;
    return [
      { value: offsetValue, color: 'var(--accent1)' },
      { value: offsetMax, color: 'var(--background-glass)' },
    ];
  }, [max, min, value]);

  return (
    <div className={styles.root}>
      <h3 className={styles.heading}>{title}</h3>
      <div className={styles.chartWrapper}>
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
            <div className={styles.value}>{formatNumber(value)}</div>
            {label ? <div className={styles.label}>{label}</div> : null}
          </div>
        </div>
        <div className={styles.footer}>
          <div>{formatNumber(min)}</div>
          <div>{formatNumber(max)}</div>
        </div>
      </div>
    </div>
  );
};

export default Gauge;
