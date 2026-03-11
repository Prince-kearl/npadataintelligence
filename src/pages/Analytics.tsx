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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Legend,
} from "recharts";

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="meta-text mt-1">In-depth analysis of incident data and trends.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Regional Distribution */}
        <div className="kpi-card">
          <h3 className="section-title mb-4">Regional Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockByRegion}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis dataKey="region" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="incidents" fill="hsl(220, 63%, 32%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Type Distribution */}
        <div className="kpi-card">
          <h3 className="section-title mb-4">Incident Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={mockByType}
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={60}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                fontSize={11}
              >
                {mockByType.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Trend */}
        <div className="kpi-card">
          <h3 className="section-title mb-4">6-Month Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockMonthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="incidents"
                stroke="hsl(220, 63%, 32%)"
                strokeWidth={2}
                dot={{ fill: "hsl(220, 63%, 32%)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Product vs Severity */}
        <div className="kpi-card">
          <h3 className="section-title mb-4">Product Type vs Incident Rate</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={mockByProduct}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis dataKey="product" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 6]} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="incidents" fill="hsl(40, 90%, 44%)" radius={[4, 4, 0, 0]} name="Incidents" />
              <Line yAxisId="right" type="monotone" dataKey="severity" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ r: 4 }} name="Severity Index" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
