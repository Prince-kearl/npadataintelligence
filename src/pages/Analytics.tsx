import { useMemo } from "react";
import { useIncidents } from "@/hooks/useIncidents";
import { incidentsByCategory, incidentsByProduct, incidentsByRegion, monthlyTrend } from "@/lib/analytics";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { ChartPageSkeleton, ErrorState } from "@/components/ReliabilityState";

const COLORS = [
  "hsl(228, 62%, 26%)",
  "hsl(224, 52%, 34%)",
  "hsl(40, 82%, 52%)",
  "hsl(152, 60%, 38%)",
  "hsl(0, 72%, 51%)",
  "hsl(25, 90%, 50%)",
  "hsl(180, 55%, 40%)",
];

const tooltipStyle = {
  contentStyle: {
    background: "#ffffff",
    border: "1px solid hsl(220, 16%, 88%)",
    borderRadius: "8px",
    color: "hsl(224, 50%, 18%)",
    fontSize: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
};

export default function Analytics() {
  const { data: incidents = [], isLoading, isError, error, refetch } = useIncidents();
  const isMobile = useIsMobile();
  const regionData = useMemo(() => incidentsByRegion(incidents), [incidents]);
  const categoryData = useMemo(() => incidentsByCategory(incidents), [incidents]);
  const trendData = useMemo(() => monthlyTrend(incidents), [incidents]);
  const productData = useMemo(() => incidentsByProduct(incidents), [incidents]);

  if (isLoading) return <ChartPageSkeleton className="min-h-[55vh]" />;
  if (isError) return <ErrorState title="Analytics data is unavailable" error={error} onRetry={() => void refetch()} className="min-h-[55vh]" />;

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
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
            <BarChart data={regionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" />
              <XAxis dataKey="region" tick={{ fontSize: isMobile ? 9 : 10, fill: "hsl(220, 15%, 50%)" }} angle={-35} textAnchor="end" height={60} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="incidents" radius={[4, 4, 0, 0]} barSize={24}>
                {regionData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" outerRadius={isMobile ? 86 : 110} innerRadius={isMobile ? 50 : 65} dataKey="value" strokeWidth={2} stroke="#fff"
                label={isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">6-Month Trend</span>
            <span className="dash-card-period">rolling six months</span>
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(224, 52%, 34%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(224, 52%, 34%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="incidents" stroke="hsl(224, 52%, 34%)" strokeWidth={2} fill="url(#analyticsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">Product vs Incident Rate</span>
            <span className="dash-card-period">all time</span>
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
            <ComposedChart data={productData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" />
              <XAxis dataKey="product" tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} domain={[0, 6]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "hsl(220, 15%, 50%)" }} />
              <Bar yAxisId="left" dataKey="incidents" fill="hsl(228, 62%, 26%)" radius={[4, 4, 0, 0]} name="Incidents" />
              <Line yAxisId="right" type="monotone" dataKey="severity" stroke="hsl(40, 82%, 52%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(40, 82%, 52%)" }} name="Severity" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
