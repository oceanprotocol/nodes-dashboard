import { ChartTypeEnum } from '@/components/chart/chart-type';
import { useCustomTooltip } from '@/components/chart/use-custom-tooltip';
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
  title: string;
};

const VBarChart = ({ axisKey, barKey, chartType, data, footer, title }: VBarChartProps) => {
  const { handleMouseMove, handleMouseLeave, CustomRechartsTooltipComponent, renderTooltipPortal } = useCustomTooltip({
    chartType,
    labelKey: axisKey,
  });

  return (
    <div className={styles.chartWrapper}>
      <h3 className={styles.heading}>{title}</h3>
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart barSize={8} data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey={axisKey} hide />
            <Bar fill="var(--accent1)" dataKey={barKey} />
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
