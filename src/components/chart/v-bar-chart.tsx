import { useCustomTooltip } from '@/components/chart/use-custom-tooltip';
import { Bar, BarChart as RechartsBarChart, Tooltip as RechartsTooltip, ResponsiveContainer, XAxis } from 'recharts';

type VBarChartProps = {
  axisKey: string;
  barKey: string;
  data: any[];
};

const VBarChart = ({ axisKey, barKey, data }: VBarChartProps) => {
  const { handleMouseMove, handleMouseLeave, CustomRechartsTooltipComponent, renderTooltipPortal } = useCustomTooltip({
    cardTitle: 'title',
  });

  return (
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
  );
};

export default VBarChart;
