import {
  AlertTriangle,
  Users,
  Skull,
  Activity,
  CheckCircle,
} from "lucide-react";
import { KPICard } from "@/components/KPICard";
import {
  mockKPIs,
  mockMonthlyTrend,
  mockByRegion,
  mockByType,
  mockIncidents,
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
} from "recharts";
import { Badge } from "@/components/ui/badge";

const statusColor: Record<string, string> = {
  New: "bg-info text-info-foreground",
  Reviewed: "bg-warning text-warning-foreground",
  Closed: "bg-success text-success-foreground",
};

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="meta-text mt-1">Regulatory incident overview — updated March 11, 2026</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Total Incidents" value={mockKPIs.totalIncidents} icon={AlertTriangle} change="+12% this month" changeType="negative" />
        <KPICard title="Total Casualties" value={mockKPIs.totalCasualties} icon={Users} change="-5% this month" changeType="positive" />
        <KPICard title="Total Fatalities" value={mockKPIs.totalFatalities} icon={Skull} change="-8% this month" changeType="positive" />
        <KPICard title="Active Cases" value={mockKPIs.activeCases} icon={Activity} change="89 pending review" changeType="neutral" />
        <KPICard title="Closed Cases" value={mockKPIs.closedCases} icon={CheckCircle} change="95.8% resolved" changeType="positive" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Incidents by Region */}
        <div className="kpi-card">
          <h3 className="section-title mb-4">Incidents by Region</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mockByRegion} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="region" type="category" tick={{ fontSize: 12 }} width={75} />
              <Tooltip />
              <Bar dataKey="incidents" fill="hsl(220, 63%, 32%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Trend */}
        <div className="kpi-card">
          <h3 className="section-title mb-4">Monthly Incident Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={mockMonthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="incidents"
                stroke="hsl(40, 90%, 44%)"
                strokeWidth={2}
                dot={{ fill: "hsl(40, 90%, 44%)", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Second charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Incident Type Distribution */}
        <div className="kpi-card">
          <h3 className="section-title mb-4">By Incident Type</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={mockByType}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={11}
              >
                {mockByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Incidents Table */}
        <div className="kpi-card lg:col-span-2">
          <h3 className="section-title mb-4">Recent Incidents</h3>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="data-table-header text-left py-2 px-3">ID</th>
                  <th className="data-table-header text-left py-2 px-3">Date</th>
                  <th className="data-table-header text-left py-2 px-3">Region</th>
                  <th className="data-table-header text-left py-2 px-3">Category</th>
                  <th className="data-table-header text-left py-2 px-3">Type</th>
                  <th className="data-table-header text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockIncidents.slice(0, 5).map((inc) => (
                  <tr key={inc.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium tabular-nums">{inc.id}</td>
                    <td className="py-2.5 px-3 tabular-nums">{inc.incident_date}</td>
                    <td className="py-2.5 px-3">{inc.region}</td>
                    <td className="py-2.5 px-3">{inc.category}</td>
                    <td className="py-2.5 px-3">{inc.incident_type}</td>
                    <td className="py-2.5 px-3">
                      <Badge className={statusColor[inc.status] || ""} variant="secondary">
                        {inc.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
