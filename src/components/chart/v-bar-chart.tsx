import { ChartTypeEnum } from '@/components/chart/chart-type';
import { useCustomTooltip } from '@/components/chart/use-custom-tooltip';
import { useMemo } from 'react';
import { Bar, BarChart as RechartsBarChart, Tooltip as RechartsTooltip, ResponsiveContainer, XAxis } from 'recharts';
import styles from './v-bar-chart.module.css';

type VBarChartProps = {
  axisKey: string;
  barKey: string;
  chartType?: ChartTypeEnum;
  data: any[];
  footer?: {
    amount: string;
    currency?: string;
    label: string;
  };
  minBars?: number;
  title: string;
};

const VBarChart = ({ axisKey, barKey, chartType, data, footer, minBars, title }: VBarChartProps) => {
  const { handleMouseMove, handleMouseLeave, CustomRechartsTooltipComponent, renderTooltipPortal } = useCustomTooltip({
    chartType,
    labelKey: axisKey,
  });

  const processedData = useMemo(() => {
    // Sort data
    const sortedData = data.sort((d1, d2) => (d1[axisKey] ?? 0) - (d2[axisKey] ?? 0));

    // Find max value
    const maxValue = data.reduce((acc, crt) => {
      if (crt[barKey] > acc) {
        return crt[barKey];
      }
      return acc;
    }, 0);

    // Add max value as a separate key to the data
    const dataWithMaxValue = sortedData.map((item) => ({ ...item, _maxValue: maxValue }));

    // Add padding at the begining if minBars is greater than data length
    if (minBars && minBars > dataWithMaxValue.length) {
      // Create empty bars at an equal distance as between the first 2 bars
      const padding = [];
      const barsToAdd = minBars - dataWithMaxValue.length;
      const axisDiff = [0, 1].includes(dataWithMaxValue.length)
        ? 1
        : dataWithMaxValue[1][axisKey] - dataWithMaxValue[0][axisKey];
      const axisStart = dataWithMaxValue.length === 0 ? 0 : dataWithMaxValue[0][axisKey];
      for (let i = 0; i < barsToAdd; i++) {
        padding.unshift({
          [axisKey]: axisStart - (i + 1) * axisDiff,
          [barKey]: 0,
          _maxValue: maxValue,
        });
      }
      // Add empty bars before the first bar
      return [...padding, ...dataWithMaxValue];
    }

    return dataWithMaxValue;
  }, [axisKey, barKey, data, minBars]);

  return (
    <div className={styles.chartWrapper}>
      <h3 className={styles.heading}>{title}</h3>
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            barGap={-8}
            barSize={8}
            data={processedData}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis dataKey={axisKey} hide />
            <Bar fill="var(--accent1)" dataKey={barKey} />
            <Bar fill="var(--background-glass-secondary)" dataKey={'_maxValue'} />
            <RechartsTooltip content={<CustomRechartsTooltipComponent />} cursor={false} />
          </RechartsBarChart>
        </ResponsiveContainer>
        {renderTooltipPortal()}
      </div>
      {footer ? (
        <div className={styles.chartFooter}>
          <div className={styles.label}>{footer.label}</div>
          <span>
            {footer.currency && <span className={styles.currency}>{footer.currency}&nbsp;</span>}
            <span className={styles.amount}>{footer.amount}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default VBarChart;
