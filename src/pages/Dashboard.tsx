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
  Area,
  AreaChart,
} from "recharts";
import { Badge } from "@/components/ui/badge";

const statusClass: Record<string, string> = {
  New: "status-new",
  Reviewed: "status-reviewed",
  Closed: "status-closed",
};

const COLORS = {
  navy: "hsl(228, 62%, 26%)",
  blue: "hsl(224, 52%, 34%)",
  gold: "hsl(40, 82%, 52%)",
  green: "hsl(152, 60%, 38%)",
  red: "hsl(0, 72%, 51%)",
  orange: "hsl(25, 90%, 50%)",
  teal: "hsl(180, 55%, 40%)",
};

const pieColors = [COLORS.navy, COLORS.blue, COLORS.gold, COLORS.green, COLORS.red, COLORS.orange, COLORS.teal];

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

export default function Dashboard() {
  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Total Incidents"
          value={mockKPIs.totalIncidents}
          icon={AlertTriangle}
          change="↑ 12% this month"
          changeType="negative"
          iconBg="bg-destructive/10"
          iconClass="text-destructive"
        />
        <KPICard
          title="Total Casualties"
          value={mockKPIs.totalCasualties}
          icon={Users}
          change="↓ 5% this month"
          changeType="positive"
          iconBg="bg-warning/10"
          iconClass="text-warning"
        />
        <KPICard
          title="Total Fatalities"
          value={mockKPIs.totalFatalities}
          icon={Skull}
          change="↓ 8% this month"
          changeType="positive"
          iconBg="bg-chart-navy/10"
          iconClass="text-chart-navy"
        />
        <KPICard
          title="Active Cases"
          value={mockKPIs.activeCases}
          icon={Activity}
          change="89 pending review"
          changeType="neutral"
          iconBg="bg-info/10"
          iconClass="text-info"
        />
        <KPICard
          title="Closed Cases"
          value={mockKPIs.closedCases}
          icon={CheckCircle}
          change="95.8% resolved"
          changeType="positive"
          iconBg="bg-success/10"
          iconClass="text-success"
        />
      </div>

      {/* Row 2: Area trend + Pie type */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="dash-card lg:col-span-3">
          <div className="dash-card-header">
            <span className="section-title">Incident Trend</span>
            <span className="dash-card-period">last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={mockMonthlyTrend}>
              <defs>
                <linearGradient id="gradientBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="incidents" stroke={COLORS.blue} strokeWidth={2} fill="url(#gradientBlue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-card lg:col-span-2">
          <div className="dash-card-header">
            <span className="section-title">By Category</span>
            <span className="dash-card-period">all time</span>
          </div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={mockByType} cx="50%" cy="50%" outerRadius={80} innerRadius={50} dataKey="value" strokeWidth={2} stroke="#fff">
                  {mockByType.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {mockByType.slice(0, 5).map((item, i) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: pieColors[i] }} />
                  <span className="text-muted-foreground flex-1">{item.name}</span>
                  <span className="tabular-nums text-foreground font-medium">
                    {Math.round((item.value / mockByType.reduce((a, b) => a + b.value, 0)) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: By Region + Recent Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="dash-card lg:col-span-2">
          <div className="dash-card-header">
            <span className="section-title">By Region</span>
            <span className="dash-card-period">all time</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={mockByRegion} layout="vertical" margin={{ left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="region" type="category" tick={{ fontSize: 11, fill: "hsl(220, 15%, 50%)" }} width={85} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="incidents" radius={[0, 4, 4, 0]} barSize={16}>
                {mockByRegion.map((_, i) => (
                  <Cell key={i} fill={pieColors[i % pieColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-card lg:col-span-3 p-0 overflow-hidden">
          <div className="dash-card-header px-5 pt-5">
            <span className="section-title">Recent Incidents</span>
            <span className="dash-card-period">last 7 days</span>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="data-table-header text-left py-2.5 px-5">ID</th>
                  <th className="data-table-header text-left py-2.5 px-4">Date</th>
                  <th className="data-table-header text-left py-2.5 px-4">Region</th>
                  <th className="data-table-header text-left py-2.5 px-4">Category</th>
                  <th className="data-table-header text-left py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockIncidents.slice(0, 5).map((inc) => (
                  <tr key={inc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-5 font-medium tabular-nums text-foreground">{inc.id}</td>
                    <td className="py-3 px-4 tabular-nums text-muted-foreground">{inc.incident_date}</td>
                    <td className="py-3 px-4 text-muted-foreground">{inc.region}</td>
                    <td className="py-3 px-4 text-muted-foreground">{inc.category}</td>
                    <td className="py-3 px-4">
                      <Badge className={statusClass[inc.status] || ""} variant="secondary">{inc.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 4: Product risk + Severity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">Product Risk Exposure</span>
            <span className="dash-card-period">all time</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={mockByProduct}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" />
              <XAxis dataKey="product" tick={{ fontSize: 11, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="incidents" radius={[4, 4, 0, 0]} barSize={28}>
                {mockByProduct.map((_, i) => (
                  <Cell key={i} fill={pieColors[i % pieColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">Severity Parameters</span>
            <span className="dash-card-period">last month</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { label: "Spills", pct: "57%", color: COLORS.navy, trend: "↑ 3.1%" },
              { label: "Fires", pct: "76%", color: COLORS.red, trend: "↑ 1.5%" },
              { label: "Leaks", pct: "21%", color: COLORS.green, trend: "↓ 10.7%" },
              { label: "Explosions", pct: "34%", color: COLORS.gold, trend: "↓ 5.2%" },
              { label: "Transport", pct: "10%", color: COLORS.blue, trend: "↑ 23.1%" },
              { label: "Equipment", pct: "45%", color: COLORS.orange, trend: "↓ 2.8%" },
            ].map((item) => (
              <div key={item.label} className="bg-muted/50 rounded-lg p-3 text-center border border-border/50">
                <div className="relative h-14 w-14 mx-auto mb-2">
                  <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(220, 16%, 90%)" strokeWidth="4" />
                    <circle cx="28" cy="28" r="24" fill="none" stroke={item.color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${parseFloat(item.pct) * 1.508} 150.8`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{item.pct}</span>
                </div>
                <p className="text-xs font-medium text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.trend}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
