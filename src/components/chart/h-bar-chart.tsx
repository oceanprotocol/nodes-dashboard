import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import styles from './h-bar-chart.module.css';

type HBarChartProps = {
  axisKey: string;
  barKey: string;
  data: any[];
};

const HBarChart = ({ axisKey, barKey, data }: HBarChartProps) => (
  <div className={styles.root}>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
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
          tick={{ fill: 'var(--text-primary)' }}
          tickLine={false}
          type="category"
          allowDecimals={false}
          width={120}
        />
        <Bar barSize={30} dataKey={barKey} fill="var(--accent1)" radius={[0, 10, 10, 0]} />
        <CartesianGrid horizontal={true} stroke="var(--border)" vertical={false} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default HBarChart;
