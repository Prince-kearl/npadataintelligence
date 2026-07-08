import { useMemo } from "react";
import { useIncidents } from "@/hooks/useIncidents";
import { incidentsByCategory, incidentsByProduct, incidentsByRegion } from "@/lib/analytics";
import {
  ChartTimeFilter,
  ChartLoadingSkeleton,
  useChartTimeFilter,
  useChartFilterLoading,
} from "@/components/ChartTimeFilter";
import {
  chartTimeLabel,
  filterByChartTime,
  trendSeries,
  type ChartTimeFilterState,
} from "@/lib/chart-time-filter";
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
import type { IncidentRow } from "@/lib/incidents";

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

interface CardHeaderProps {
  title: string;
  state: ChartTimeFilterState;
  onChange: (s: ChartTimeFilterState) => void;
  fallbackLabel?: string;
}

function CardHeader({ title, state, onChange, fallbackLabel = "All time" }: CardHeaderProps) {
  return (
    <div className="dash-card-header flex-wrap gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="section-title">{title}</span>
        <span className="dash-card-period">{chartTimeLabel(state, fallbackLabel)}</span>
      </div>
      <ChartTimeFilter value={state} onChange={onChange} compact />
    </div>
  );
}

export default function Analytics() {
  const { data: incidents = [], isLoading, isError, error, refetch } = useIncidents();
  const isMobile = useIsMobile();

  // Each card owns its own filter — users can compare timeframes.
  const [regionFilter, setRegionFilter] = useChartTimeFilter();
  const [typeFilter, setTypeFilter] = useChartTimeFilter();
  const [trendFilter, setTrendFilter] = useChartTimeFilter();
  const [productFilter, setProductFilter] = useChartTimeFilter();

  const regionLoading = useChartFilterLoading(regionFilter);
  const typeLoading = useChartFilterLoading(typeFilter);
  const trendLoading = useChartFilterLoading(trendFilter);
  const productLoading = useChartFilterLoading(productFilter);

  const regionRows = useMemo<IncidentRow[]>(() => filterByChartTime(incidents, regionFilter), [incidents, regionFilter]);
  const typeRows = useMemo<IncidentRow[]>(() => filterByChartTime(incidents, typeFilter), [incidents, typeFilter]);
  const trendRows = useMemo<IncidentRow[]>(() => filterByChartTime(incidents, trendFilter), [incidents, trendFilter]);
  const productRows = useMemo<IncidentRow[]>(() => filterByChartTime(incidents, productFilter), [incidents, productFilter]);

  const regionData = useMemo(() => incidentsByRegion(regionRows), [regionRows]);
  const categoryData = useMemo(() => incidentsByCategory(typeRows), [typeRows]);
  const trendData = useMemo(() => trendSeries(trendRows, trendFilter), [trendRows, trendFilter]);
  const productData = useMemo(() => incidentsByProduct(productRows), [productRows]);

  if (isLoading) return <ChartPageSkeleton className="min-h-[55vh]" />;
  if (isError) return <ErrorState title="Analytics data is unavailable" error={error} onRetry={() => void refetch()} className="min-h-[55vh]" />;

  const chartH = isMobile ? 240 : 300;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="meta-text mt-1">In-depth analysis of incident data and trends. Filter each card independently.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dash-card">
          <CardHeader title="Regional Distribution" state={regionFilter} onChange={setRegionFilter} />
          {regionLoading ? <ChartLoadingSkeleton height={chartH} /> : (
            <ResponsiveContainer width="100%" height={chartH}>
              <BarChart data={regionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" />
                <XAxis dataKey="region" tick={{ fontSize: isMobile ? 9 : 10, fill: "hsl(220, 15%, 50%)" }} angle={-35} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="incidents" radius={[4, 4, 0, 0]} barSize={24}>
                  {regionData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dash-card">
          <CardHeader title="Type Distribution" state={typeFilter} onChange={setTypeFilter} />
          {typeLoading ? <ChartLoadingSkeleton height={chartH} /> : (
            <ResponsiveContainer width="100%" height={chartH}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={isMobile ? 86 : 110} innerRadius={isMobile ? 50 : 65} dataKey="value" strokeWidth={2} stroke="#fff"
                  label={isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}
                >
                  {categoryData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dash-card">
          <CardHeader title="Incident Trend" state={trendFilter} onChange={setTrendFilter} fallbackLabel="rolling 6 months" />
          {trendLoading ? <ChartLoadingSkeleton height={chartH} /> : (
            <ResponsiveContainer width="100%" height={chartH}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(224, 52%, 34%)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(224, 52%, 34%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="incidents" stroke="hsl(224, 52%, 34%)" strokeWidth={2} fill="url(#analyticsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dash-card">
          <CardHeader title="Product vs Incident Rate" state={productFilter} onChange={setProductFilter} />
          {productLoading ? <ChartLoadingSkeleton height={chartH} /> : (
            <ResponsiveContainer width="100%" height={isMobile ? 250 : chartH}>
              <ComposedChart data={productData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" />
                <XAxis dataKey="product" tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px", color: "hsl(220, 15%, 50%)" }} />
                <Bar yAxisId="left" dataKey="incidents" fill="hsl(228, 62%, 26%)" radius={[4, 4, 0, 0]} name="Incidents" />
                <Line yAxisId="right" type="monotone" dataKey="casualties" stroke="hsl(40, 82%, 52%)" strokeWidth={2} dot={{ r: 4, fill: "hsl(40, 82%, 52%)" }} name="Casualties" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
