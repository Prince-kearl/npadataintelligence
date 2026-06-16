import {
  AlertTriangle,
  Users,
  Skull,
  Activity,
  CheckCircle,
  Radio,
  MapPin,
  Clock,
  Send,
  Flame,
  ShieldAlert,
  Lock,
  PhoneCall,
  MoreHorizontal,
} from "lucide-react";
import { KPICard } from "@/components/KPICard";
import {
  mockMonthlyTrend,
  mockByRegion,
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
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { HotspotMap } from "@/components/HotspotMap";
import { useIncidents } from "@/hooks/useIncidents";

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

const liveFeed = [
  {
    severity: "Critical",
    title: "Critical Alert: Major Spill - Tema Oil Depot",
    time: "14:31",
    tag: "Urgent",
    meta: "Response Unit 3 dispatched",
    color: "destructive",
  },
  {
    severity: "Major",
    title: "Major Incident: LPG Explosion - Tamale",
    time: "13:55",
    tag: "High",
    meta: "HAZMAT Response",
    color: "warning",
  },
  {
    severity: "Medium",
    title: "Medium Alert: Pipeline Pressure Anomaly - Western",
    time: "12:40",
    tag: "Area Verified",
    color: "info",
  },
  {
    severity: "Low",
    title: "Low Alert: Suspicious Storage Activity - Volta",
    time: "11:18",
    tag: "Monitored",
    color: "success",
  },
];

const hotspots = [
  { name: "Tema", x: 62, y: 78, intensity: "high" },
  { name: "Accra", x: 55, y: 82, intensity: "high" },
  { name: "Takoradi", x: 30, y: 86, intensity: "med" },
  { name: "Kumasi", x: 48, y: 60, intensity: "high" },
  { name: "Tamale", x: 50, y: 32, intensity: "med" },
  { name: "Bolgatanga", x: 52, y: 14, intensity: "low" },
  { name: "Ho", x: 72, y: 70, intensity: "med" },
  { name: "Sunyani", x: 36, y: 50, intensity: "low" },
];

const severityBarClass: Record<string, string> = {
  Critical: "bg-destructive",
  Major: "bg-warning",
  Medium: "bg-info",
  Low: "bg-success",
};

const CATEGORY_COLORS: Record<string, string> = {
  Spill: COLORS.blue,
  Fire: COLORS.red,
  Explosion: COLORS.gold,
  Leakage: COLORS.teal,
  "Equipment Failure": COLORS.orange,
  "BRV Crash/Accident": COLORS.green,
  "Illegal Activity": COLORS.navy,
};

function CategoryTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground tabular-nums">{d.value} incidents · {d.pct}%</p>
      <p className="text-[10px] text-accent mt-0.5">Click to view filtered records →</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: incidents = [] } = useIncidents();

  const threatDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    incidents.forEach((inc) => {
      counts.set(inc.category, (counts.get(inc.category) || 0) + 1);
    });
    const total = incidents.length || 1;
    return Array.from(counts.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct: Math.round((value / total) * 100),
        fill: CATEGORY_COLORS[name] || COLORS.navy,
      }))
      .sort((a, b) => b.value - a.value);
  }, [incidents]);

  const kpis = useMemo(() => {
    const total = incidents.length;
    const open = incidents.filter((i) => i.status !== "Closed").length;
    const closed = incidents.filter((i) => i.status === "Closed").length;
    const casualties = incidents.reduce((s, i) => s + (i.casualties || 0), 0);
    const fatalities = incidents.reduce((s, i) => s + (i.fatalities || 0), 0);
    return { total, open, closed, casualties, fatalities };
  }, [incidents]);

  const drillDown = (category: string) => {
    navigate(`/records?category=${encodeURIComponent(category)}`);
  };

  return (
    <div className="space-y-5">
      {/* Executive Overview header */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Executive Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time petroleum sector incident intelligence
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10 text-success font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Live
          </span>
          <span className="text-muted-foreground">Auto-refresh 30s</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Total Incidents Today"
          value={438}
          icon={AlertTriangle}
          change="↑ 12.1% vs yesterday"
          changeType="negative"
          iconBg="bg-destructive/10"
          iconClass="text-destructive"
        />
        <KPICard
          title="Active Security Alerts"
          value={57}
          icon={ShieldAlert}
          change="↓ 3.4% this week"
          changeType="positive"
          iconBg="bg-warning/10"
          iconClass="text-warning"
        />
        <KPICard
          title="Resolved Cases"
          value={381}
          icon={CheckCircle}
          change="↑ 15.5% this week"
          changeType="positive"
          iconBg="bg-success/10"
          iconClass="text-success"
        />
        <KPICard
          title="Emergency Response Rate"
          value="98.4%"
          icon={Activity}
          change="Optimal"
          changeType="positive"
          iconBg="bg-info/10"
          iconClass="text-info"
        />
        <KPICard
          title="High Risk Incidents"
          value={9}
          icon={Flame}
          change="Warning"
          changeType="negative"
          iconBg="bg-primary/15"
          iconClass="text-primary"
        />
      </div>

      {/* Row: Real-time Feed + Hotspot Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="dash-card lg:col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-destructive" />
              <span className="section-title">Real-time Incident Feed</span>
              <span className="text-xs text-muted-foreground">· Updates continuously</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                Live Incidents
              </span>
              <button className="text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {liveFeed.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                <span className={`w-1 h-10 rounded-full ${severityBarClass[f.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.title}</p>
                  {f.meta && <p className="text-[11px] text-muted-foreground mt-0.5">{f.meta}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs tabular-nums text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {f.time}
                  </span>
                  <Badge variant="secondary" className={
                    f.severity === "Critical" ? "status-new" :
                    f.severity === "Major" ? "bg-warning/15 text-warning border border-warning/20" :
                    f.severity === "Medium" ? "status-reviewed" : "status-closed"
                  }>
                    {f.tag}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-card">
          <div className="dash-card-header">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="section-title">Incident Hotspot Heatmap</span>
            </div>
            <span className="dash-card-period">live GPS · {incidents.length} sites</span>
          </div>
          <HotspotMap
            incidents={incidents as any}
            height={340}
            onSelect={(inc: any) => navigate(`/records?id=${encodeURIComponent(inc.id)}`)}
          />
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> Major</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: COLORS.orange }} /> Minor</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Near miss / Obs</span>
            <span>Click a hotspot for details</span>
          </div>
        </div>
      </div>


      {/* Row: Trends + Threat distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="dash-card lg:col-span-2">
          <div className="dash-card-header">
            <span className="section-title">Incident Trends</span>
            <span className="dash-card-period">last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={mockMonthlyTrend}>
              <defs>
                <linearGradient id="gradientBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.25} />
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

        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">Threat Distribution</span>
            <span className="dash-card-period">live · {mockIncidents.length} incidents</span>
          </div>
          <div className="flex items-center gap-3">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie
                  data={threatDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={48}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#fff"
                  onClick={(d: any) => drillDown(d.name)}
                  className="cursor-pointer"
                >
                  {threatDistribution.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CategoryTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {threatDistribution.map((d) => (
                <button
                  key={d.name}
                  onClick={() => drillDown(d.name)}
                  className="w-full flex items-center gap-2 text-xs py-1 px-1.5 rounded hover:bg-muted/60 transition-colors text-left"
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                  <span className="text-muted-foreground flex-1 truncate">{d.name}</span>
                  <span className="tabular-nums font-medium text-foreground">{d.value}</span>
                  <span className="tabular-nums text-muted-foreground text-[10px] w-9 text-right">{d.pct}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* Row: By Region + Recent table */}
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

      {/* Row: Product risk */}
      <div className="dash-card">
        <div className="dash-card-header">
          <span className="section-title">Product Risk Exposure</span>
          <span className="dash-card-period">all time</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
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

      {/* Regulatory Command Panel */}
      <div className="dash-card bg-gradient-to-r from-navy via-accent to-navy text-navy-foreground border-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Regulatory Command Panel</p>
              <p className="text-[11px] text-navy-foreground/70">Quick actions for incident response & enforcement</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 h-8">
              <Send className="h-3.5 w-3.5 mr-1.5" /> Dispatch Team
            </Button>
            <Button size="sm" variant="secondary" className="bg-navy-foreground/10 text-navy-foreground border border-navy-foreground/20 hover:bg-navy-foreground/15 h-8">
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Escalate Alert
            </Button>
            <Button size="sm" variant="secondary" className="bg-navy-foreground/10 text-navy-foreground border border-navy-foreground/20 hover:bg-navy-foreground/15 h-8">
              <Lock className="h-3.5 w-3.5 mr-1.5" /> Lockdown Protocol
            </Button>
            <Button size="sm" variant="secondary" className="bg-navy-foreground/10 text-navy-foreground border border-navy-foreground/20 hover:bg-navy-foreground/15 h-8">
              <PhoneCall className="h-3.5 w-3.5 mr-1.5" /> Request Reinforcement
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
