import {
  mockMonthlyTrend,
  mockByRegion,
  mockByType,
  mockByProduct,
} from "@/lib/mock-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(265, 80%, 60%)",
  "hsl(330, 80%, 60%)",
  "hsl(160, 84%, 44%)",
  "hsl(45, 96%, 58%)",
  "hsl(210, 80%, 55%)",
  "hsl(25, 95%, 53%)",
  "hsl(180, 70%, 45%)",
];

const tooltipStyle = {
  contentStyle: {
    background: "hsl(228, 15%, 14%)",
    border: "1px solid hsl(228, 12%, 20%)",
    borderRadius: "12px",
    color: "hsl(0, 0%, 95%)",
    fontSize: "12px",
  },
};

export default function Analytics() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="meta-text mt-1">In-depth analysis of incident data and trends.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">Regional Distribution</span>
            <span className="dash-card-period">all time</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockByRegion}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(228, 12%, 20%)" />
              <XAxis dataKey="region" tick={{ fontSize: 10, fill: "hsl(228, 10%, 55%)" }} angle={-35} textAnchor="end" height={60} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(228, 10%, 55%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="incidents" radius={[6, 6, 0, 0]} barSize={24}>
                {mockByRegion.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">Type Distribution</span>
            <span className="dash-card-period">all time</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={mockByType} cx="50%" cy="50%" outerRadius={110} innerRadius={65} dataKey="value" strokeWidth={0}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}
              >
                {mockByType.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">6-Month Trend</span>
            <span className="dash-card-period">Oct 2025 — Mar 2026</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={mockMonthlyTrend}>
              <defs>
                <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160, 84%, 44%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(160, 84%, 44%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(228, 12%, 20%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(228, 10%, 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(228, 10%, 55%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="incidents" stroke="hsl(160, 84%, 44%)" strokeWidth={2} fill="url(#analyticsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">Product vs Incident Rate</span>
            <span className="dash-card-period">all time</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={mockByProduct}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(228, 12%, 20%)" />
              <XAxis dataKey="product" tick={{ fontSize: 12, fill: "hsl(228, 10%, 55%)" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "hsl(228, 10%, 55%)" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "hsl(228, 10%, 55%)" }} axisLine={false} tickLine={false} domain={[0, 6]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "hsl(228, 10%, 55%)" }} />
              <Bar yAxisId="left" dataKey="incidents" fill="hsl(265, 80%, 60%)" radius={[6, 6, 0, 0]} name="Incidents" />
              <Line yAxisId="right" type="monotone" dataKey="severity" stroke="hsl(330, 80%, 60%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(330, 80%, 60%)" }} name="Severity" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
