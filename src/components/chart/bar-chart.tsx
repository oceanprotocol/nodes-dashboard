import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis } from 'recharts';

type ChartProps = {
  axisKey: string;
  barKey: string;
  data: any[];
};

const BarChart = ({ axisKey, barKey, data }: ChartProps) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart barSize={8} data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey={axisKey} hide />
        <Bar fill="#009bff" dataKey={barKey} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};

export default BarChart;
