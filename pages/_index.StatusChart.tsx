import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../components/Chart';

type DashboardStatusChartProps = {
  data: Array<{
    status: string;
    count: number;
  }>;
  config: {
    count: {
      label: string;
      color: string;
    };
  };
};

export default function DashboardStatusChart({
  data,
  config,
}: DashboardStatusChartProps) {
  return (
    <ChartContainer config={config}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="status" axisLine={false} tickLine={false} />
        <YAxis axisLine={false} tickLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
