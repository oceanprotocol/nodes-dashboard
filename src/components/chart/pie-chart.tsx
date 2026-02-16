import { ChartTypeEnum } from '@/components/chart/chart-type';
import { useCustomTooltip } from '@/components/chart/use-custom-tooltip';
import React, { useMemo, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import styles from './pie-chart.module.css';

type PieChartItem = {
  color: string;
  details?: string[];
  name: string;
  value: number;
};

type PieChartCardProps = {
  chartType?: ChartTypeEnum;
  data: PieChartItem[];
  title: string;
};

const PieChart: React.FC<PieChartCardProps> = ({ chartType, data, title }) => {
  const { handleMouseMove, handleMouseLeave, CustomRechartsTooltipComponent, renderTooltipPortal } = useCustomTooltip({
    chartType,
    labelKey: 'name',
  });

  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [lockedIndex, setLockedIndex] = useState<number | undefined>(undefined);
  const [hoverText, setHoverText] = useState('Hover to see details');

  const totalValue = useMemo(() => data.reduce((sum, entry) => sum + entry.value, 0), [data]);

  const onPieEnter = (_: any, index: number) => {
    if (lockedIndex === undefined) {
      setActiveIndex(index);
      const percentage = ((data[index].value / totalValue) * 100).toFixed(2);
      setHoverText(`${data[index].name}: ${percentage}%`);
    }
  };

  const onPieLeave = () => {
    if (lockedIndex === undefined) {
      setActiveIndex(undefined);
      setHoverText('Hover to see details');
    }
  };

  const onPieClick = (_: any, index: number) => {
    if (lockedIndex === index) {
      setLockedIndex(undefined);
      setActiveIndex(undefined);
      setHoverText('Hover to see details');
    } else {
      setLockedIndex(index);
      setActiveIndex(index);
      const percentage = ((data[index].value / totalValue) * 100).toFixed(2);
      setHoverText(`${data[index].name}: ${percentage}%`);
    }
  };

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 15}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          filter="url(#glow)"
        />
      </g>
    );
  };

  return (
    <div className={styles.root} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <RechartsPieChart>
          <Pie
            // activeIndex={activeIndex}
            activeShape={renderActiveShape}
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={0}
            dataKey="value"
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
            onClick={onPieClick}
            className={styles.pieHover}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="none"
                style={{
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: activeIndex === index || lockedIndex === index ? 'url(#glow)' : 'none',
                  transform: activeIndex === index || lockedIndex === index ? 'scale(1.05)' : 'scale(1)',
                }}
              />
            ))}
          </Pie>
          <RechartsTooltip content={<CustomRechartsTooltipComponent />} cursor={false} />
        </RechartsPieChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'center', marginTop: '8px' }}>{hoverText}</div>
      {renderTooltipPortal()}
    </div>
  );
};

export default PieChart;
