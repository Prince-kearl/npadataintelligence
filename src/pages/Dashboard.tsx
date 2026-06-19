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
import { incidentsByProduct, incidentsByRegion, monthlyTrend } from "@/lib/analytics";
import { createIncidentResponseAction, STATUS_LABELS, type ResponseActionType } from "@/lib/incidents";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { HotspotMap } from "@/components/HotspotMap";
import { useIncidents } from "@/hooks/useIncidents";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

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

const severityBarClass: Record<string, string> = {
  Critical: "bg-destructive",
  High: "bg-warning",
  Medium: "bg-info",
  Low: "bg-success",
};

const RESPONSE_ACTIONS: Record<ResponseActionType, { label: string; prompt: string }> = {
  dispatch_team: {
    label: "Dispatch Team",
    prompt: "Dispatch the appropriate field response team and confirm the assigned unit.",
  },
  escalate_alert: {
    label: "Escalate Alert",
    prompt: "Escalate this incident to the emergency coordination chain for immediate attention.",
  },
  lockdown_protocol: {
    label: "Lockdown Protocol",
    prompt: "Initiate site lockdown protocol and restrict access pending an authorized safety review.",
  },
  request_reinforcement: {
    label: "Request Reinforcement",
    prompt: "Request additional personnel and specialist support for the active response.",
  },
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

const SEVERITY_COLORS: Record<string, string> = {
  critical: COLORS.red,
  high: COLORS.orange,
  medium: COLORS.gold,
  low: COLORS.green,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: incidents = [] } = useIncidents();
  const { role } = useRole();
  const [selectedAction, setSelectedAction] = useState<ResponseActionType | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [commandInstructions, setCommandInstructions] = useState("");
  const [isIssuingCommand, setIsIssuingCommand] = useState(false);
  const eligibleIncidents = useMemo(
    () => incidents.filter((incident) => !["Closed", "archived"].includes(incident.status)),
    [incidents]
  );
  const canIssueCommand = role === "analyst" || role === "admin";
  const activeCommand = selectedAction ? RESPONSE_ACTIONS[selectedAction] : null;

  const openCommand = (action: ResponseActionType) => {
    if (!canIssueCommand) {
      toast.error("An Analyst or Administrator role is required to issue response commands.");
      return;
    }
    if (action === "lockdown_protocol" && role !== "admin") {
      toast.error("Only a System Administrator may initiate lockdown protocol.");
      return;
    }
    if (!eligibleIncidents.length) {
      toast.error("There are no active incidents available for this command.");
      return;
    }
    setSelectedAction(action);
    setSelectedIncidentId(eligibleIncidents[0].id);
    setCommandInstructions(RESPONSE_ACTIONS[action].prompt);
  };

  const issueCommand = async () => {
    if (!selectedAction || !selectedIncidentId || commandInstructions.trim().length < 5) return;
    setIsIssuingCommand(true);
    try {
      await createIncidentResponseAction(selectedIncidentId, selectedAction, commandInstructions.trim());
      toast.success(`${RESPONSE_ACTIONS[selectedAction].label} command issued and audit logged.`);
      setSelectedAction(null);
      setSelectedIncidentId("");
      setCommandInstructions("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to issue response command");
    } finally {
      setIsIssuingCommand(false);
    }
  };
  const trendData = useMemo(() => monthlyTrend(incidents), [incidents]);
  const regionData = useMemo(() => incidentsByRegion(incidents).slice(0, 8), [incidents]);
  const productData = useMemo(() => incidentsByProduct(incidents), [incidents]);
  const liveFeed = useMemo(() => [...incidents]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4)
    .map((incident) => ({
      severity: incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1),
      title: `${incident.category}: ${incident.location_name}`,
      time: new Date(incident.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      tag: STATUS_LABELS[incident.status] || incident.status,
      meta: `${incident.region}${incident.district ? ` · ${incident.district}` : ""}`,
    })), [incidents]);

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

  const severityDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    incidents.forEach((inc) => {
      const sev = (inc as any).severity || "medium";
      counts.set(sev, (counts.get(sev) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      fill: SEVERITY_COLORS[name] || COLORS.navy,
    }));
  }, [incidents]);

  const topCauses = useMemo(() => {
    const counts = new Map<string, number>();
    incidents.forEach((i) => {
      const key = `${i.category} · ${i.product_type || "—"}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [incidents]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const last30 = incidents.filter((i) => now - new Date(i.incident_date).getTime() <= 30 * day);
    const prev30 = incidents.filter((i) => {
      const t = new Date(i.incident_date).getTime();
      return now - t > 30 * day && now - t <= 60 * day;
    });
    const delta = prev30.length ? Math.round(((last30.length - prev30.length) / prev30.length) * 100) : 0;
    const critical = incidents.filter((i: any) => i.severity === "critical" || i.severity === "high").length;
    const open = incidents.filter((i) => !["Closed", "archived"].includes(i.status as any)).length;
    const closed = incidents.filter((i) => ["Closed", "archived"].includes(i.status)).length;
    const resolveRate = incidents.length ? Math.round((closed / incidents.length) * 100) : 0;
    return { total: incidents.length, last30: last30.length, delta, open, closed, critical, resolveRate };
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
          title="Total Incidents (30d)"
          value={kpis.last30}
          icon={AlertTriangle}
          change={kpis.delta === 0 ? "No prior period" : `${kpis.delta > 0 ? "↑" : "↓"} ${Math.abs(kpis.delta)}% vs prev 30d`}
          changeType={kpis.delta > 0 ? "negative" : kpis.delta < 0 ? "positive" : "neutral"}
          iconBg="bg-destructive/10"
          iconClass="text-destructive"
        />
        <KPICard
          title="High / Critical Severity"
          value={kpis.critical}
          icon={ShieldAlert}
          change={kpis.total ? `${Math.round((kpis.critical / kpis.total) * 100)}% of all` : "—"}
          changeType={kpis.critical > 0 ? "negative" : "positive"}
          iconBg="bg-warning/10"
          iconClass="text-warning"
        />
        <KPICard
          title="Resolved Cases"
          value={kpis.closed}
          icon={CheckCircle}
          change={`${kpis.resolveRate}% resolve rate`}
          changeType="positive"
          iconBg="bg-success/10"
          iconClass="text-success"
        />
        <KPICard
          title="Open Cases"
          value={kpis.open}
          icon={Activity}
          change="Across all stages"
          changeType="neutral"
          iconBg="bg-info/10"
          iconClass="text-info"
        />
        <KPICard
          title="Total On Record"
          value={kpis.total}
          icon={Flame}
          change="All-time"
          changeType="neutral"
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
                    f.severity === "High" ? "bg-warning/15 text-warning border border-warning/20" :
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
            incidents={incidents}
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
            <AreaChart data={trendData}>
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
            <span className="dash-card-period">live · {incidents.length} incidents</span>
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

      {/* Row: Severity distribution + Top recurring causes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">Severity Distribution</span>
            <span className="dash-card-period">live</span>
          </div>
          {severityDistribution.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-12">No severity data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={severityDistribution} cx="50%" cy="50%" outerRadius={75} innerRadius={48} dataKey="value" strokeWidth={2} stroke="#fff">
                  {severityDistribution.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
            {severityDistribution.map((d) => (
              <span key={d.name} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} /> {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>

        <div className="dash-card lg:col-span-2">
          <div className="dash-card-header">
            <span className="section-title">Top Recurring Causes</span>
            <span className="dash-card-period">category · product</span>
          </div>
          {topCauses.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-12">No incident data yet</p>
          ) : (
            <div className="space-y-2.5">
              {topCauses.map((c, i) => {
                const max = topCauses[0].value || 1;
                const pct = Math.round((c.value / max) * 100);
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground truncate">{i + 1}. {c.name}</span>
                      <span className="tabular-nums text-muted-foreground">{c.value}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pieColors[i % pieColors.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
            <BarChart data={regionData} layout="vertical" margin={{ left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="region" type="category" tick={{ fontSize: 11, fill: "hsl(220, 15%, 50%)" }} width={85} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="incidents" radius={[0, 4, 4, 0]} barSize={16}>
                {regionData.map((_, i) => (
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
                {incidents.slice(0, 5).map((inc) => (
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
          <BarChart data={productData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" />
            <XAxis dataKey="product" tick={{ fontSize: 11, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(220, 15%, 50%)" }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="incidents" radius={[4, 4, 0, 0]} barSize={28}>
              {productData.map((_, i) => (
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
            <Button size="sm" onClick={() => openCommand("dispatch_team")} disabled={!canIssueCommand || !eligibleIncidents.length} className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 disabled:opacity-50">
              <Send className="h-3.5 w-3.5 mr-1.5" /> Dispatch Team
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openCommand("escalate_alert")} disabled={!canIssueCommand || !eligibleIncidents.length} className="bg-navy-foreground/10 text-navy-foreground border border-navy-foreground/20 hover:bg-navy-foreground/15 h-8 disabled:opacity-50">
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Escalate Alert
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openCommand("lockdown_protocol")} disabled={role !== "admin" || !eligibleIncidents.length} className="bg-navy-foreground/10 text-navy-foreground border border-navy-foreground/20 hover:bg-navy-foreground/15 h-8 disabled:opacity-50">
              <Lock className="h-3.5 w-3.5 mr-1.5" /> Lockdown Protocol
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openCommand("request_reinforcement")} disabled={!canIssueCommand || !eligibleIncidents.length} className="bg-navy-foreground/10 text-navy-foreground border border-navy-foreground/20 hover:bg-navy-foreground/15 h-8 disabled:opacity-50">
              <PhoneCall className="h-3.5 w-3.5 mr-1.5" /> Request Reinforcement
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={selectedAction !== null} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{activeCommand?.label}</DialogTitle>
            <DialogDescription>
              Select the active incident and confirm operational instructions. The command is persisted with your identity and written to the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="command-incident">Active incident</Label>
              <Select value={selectedIncidentId} onValueChange={setSelectedIncidentId}>
                <SelectTrigger id="command-incident">
                  <SelectValue placeholder="Select an incident" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleIncidents.map((incident) => (
                    <SelectItem key={incident.id} value={incident.id}>
                      {incident.reference_code} · {incident.category} · {incident.location_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="command-instructions">Operational instructions</Label>
              <Textarea
                id="command-instructions"
                value={commandInstructions}
                onChange={(event) => setCommandInstructions(event.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="State the unit, coordination channel, safety constraints, and expected response."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAction(null)} disabled={isIssuingCommand}>Cancel</Button>
            <Button onClick={issueCommand} disabled={isIssuingCommand || !selectedIncidentId || commandInstructions.trim().length < 5}>
              {isIssuingCommand ? "Issuing…" : `Issue ${activeCommand?.label ?? "Command"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
