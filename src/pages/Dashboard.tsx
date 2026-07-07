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
  ClipboardCheck,
  FileEdit,
  BarChart3,
  
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
import { ErrorState, PageSkeleton } from "@/components/ReliabilityState";
import { useAuth } from "@/hooks/useAuth";

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

const statusFeedClass: Record<string, string> = {
  New: "bg-info",
  Reviewed: "bg-warning",
  Closed: "bg-success",
  submitted: "bg-info",
  under_review: "bg-warning",
  verified: "bg-success",
  archived: "bg-muted-foreground",
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


export default function Dashboard() {
  const navigate = useNavigate();
  const incidentsQuery = useIncidents();
  const { data: incidents = [], isLoading, isError, error, refetch, isFetching } = incidentsQuery;
  const { role } = useRole();
  const { profile } = useAuth();
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
      status: incident.status,
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

  const statusDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    incidents.forEach((inc) => {
      counts.set(inc.status, (counts.get(inc.status) || 0) + 1);
    });
    const palette: Record<string, string> = {
      New: COLORS.blue,
      submitted: COLORS.blue,
      under_review: COLORS.gold,
      Reviewed: COLORS.gold,
      returned: COLORS.orange,
      verified: COLORS.teal,
      Closed: COLORS.green,
      archived: COLORS.navy,
      draft: COLORS.navy,
    };
    return Array.from(counts.entries()).map(([name, value]) => ({
      name: STATUS_LABELS[name] || name,
      value,
      fill: palette[name] || COLORS.navy,
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
    const casualties = incidents.reduce((sum, i) => sum + (i.casualties ?? 0), 0);
    const open = incidents.filter((i) => !["Closed", "archived"].includes(i.status as any)).length;
    const closed = incidents.filter((i) => ["Closed", "archived"].includes(i.status)).length;
    const resolveRate = incidents.length ? Math.round((closed / incidents.length) * 100) : 0;
    return { total: incidents.length, last30: last30.length, delta, open, closed, casualties, resolveRate };
  }, [incidents]);

  const drillDown = (category: string) => {
    navigate(`/records?category=${encodeURIComponent(category)}`);
  };

  const dashboardCopy = role === "collector"
    ? { title: "Field Operations", subtitle: "Your submitted incidents and field follow-up", eyebrow: "Collector workspace" }
    : role === "analyst"
      ? { title: "Incident Review Desk", subtitle: "Verification queues, trends and regulatory response", eyebrow: "Analyst workspace" }
      : role === "admin"
        ? { title: "Executive Command Overview", subtitle: "Sector-wide incident intelligence and system oversight", eyebrow: "Administrator workspace" }
        : { title: "Incident Dashboard", subtitle: "Your account has not yet been assigned an operational role", eyebrow: "Limited workspace" };

  if (isLoading) return <PageSkeleton className="min-h-[55vh]" />;
  if (isError) return <ErrorState title="Dashboard data is unavailable" error={error} onRetry={() => void refetch()} className="min-h-[55vh]" />;

  return (
    <div className="space-y-5">
      {/* Executive Overview header */}
      <div className="flex items-start sm:items-end justify-between flex-wrap gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{dashboardCopy.eyebrow}</p>
          <h1 className="mt-1 text-xl font-bold text-foreground">{dashboardCopy.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dashboardCopy.subtitle}{profile?.full_name ? ` · ${profile.full_name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10 text-success font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            {isFetching ? "Refreshing" : "Live"}
          </span>
          <span className="text-muted-foreground">Auto-refresh 30s</span>
        </div>
      </div>

      {role === "collector" && (
        <div className="dash-card border-primary/20 bg-primary/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold text-foreground"><FileEdit className="h-4 w-4 text-primary" />Field reporting</p>
              <p className="mt-1 text-sm text-muted-foreground">You can see {kpis.total} permitted report{kpis.total === 1 ? "" : "s"}, with {kpis.open} still active.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <Button onClick={() => navigate("/submit")}><FileEdit className="mr-2 h-4 w-4" />Submit incident</Button>
              <Button variant="outline" onClick={() => navigate("/records")}>View my records</Button>
            </div>
          </div>
        </div>
      )}
      {role === "analyst" && (
        <div className="dash-card border-info/20 bg-info/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold text-foreground"><ClipboardCheck className="h-4 w-4 text-info" />Review priority</p>
              <p className="mt-1 text-sm text-muted-foreground">{incidents.filter((item) => ["submitted", "under_review", "returned", "New", "Reviewed"].includes(item.status)).length} cases require review or follow-up.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <Button onClick={() => navigate("/records?status=submitted")}>Open review queue</Button>
              <Button variant="outline" onClick={() => navigate("/analytics")}><BarChart3 className="mr-2 h-4 w-4" />Analyse trends</Button>
            </div>
          </div>
        </div>
      )}

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
          to="/records?range=30d"
          ctaLabel="View last 30 days"
        />
        <KPICard
          title="Casualties (all-time)"
          value={kpis.casualties}
          icon={ShieldAlert}
          change={kpis.total ? `${(kpis.casualties / kpis.total).toFixed(1)} avg / incident` : "—"}
          changeType={kpis.casualties > 0 ? "negative" : "positive"}
          iconBg="bg-warning/10"
          iconClass="text-warning"
          to="/analytics"
          ctaLabel="Open analytics"
        />
        <KPICard
          title="Resolved Cases"
          value={kpis.closed}
          icon={CheckCircle}
          change={`${kpis.resolveRate}% resolve rate`}
          changeType="positive"
          iconBg="bg-success/10"
          iconClass="text-success"
          to="/records?status=Closed"
          ctaLabel="View resolved"
        />
        <KPICard
          title="Open Cases"
          value={kpis.open}
          icon={Activity}
          change="Across all stages"
          changeType="neutral"
          iconBg="bg-info/10"
          iconClass="text-info"
          to="/records?status=Open"
          ctaLabel="View open cases"
        />
        <KPICard
          title="All-Time Records"
          value={kpis.total}
          icon={Flame}
          change="All-time"
          changeType="neutral"
          iconBg="bg-primary/15"
          iconClass="text-primary"
          to="/records"
          ctaLabel="Browse all-time records"
        />
      </div>

      {/* Row: Real-time Feed + Hotspot Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="dash-card lg:col-span-2 p-0 overflow-hidden">
          <div className="flex items-start sm:items-center justify-between gap-2 px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <Radio className="h-4 w-4 text-destructive" />
              <span className="section-title">Real-time Incident Feed</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">· Updates continuously</span>
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
            {liveFeed.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No incidents are currently visible to your role.</p>}
            {liveFeed.map((f, i) => (
              <div key={i} className="flex items-start sm:items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors">
                <span className={`w-1 h-10 rounded-full ${statusFeedClass[f.status] || "bg-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.title}</p>
                  {f.meta && <p className="text-[11px] text-muted-foreground mt-0.5">{f.meta}</p>}
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 shrink-0">
                  <span className="text-xs tabular-nums text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {f.time}
                  </span>
                  <Badge variant="secondary" className={
                    f.status === "New" || f.status === "submitted" ? "status-new" :
                    f.status === "Reviewed" || f.status === "under_review" ? "status-reviewed" :
                    "status-closed"
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
            height="clamp(260px, 70vw, 340px)"
            onSelect={(inc: any) => navigate(`/incidents/${encodeURIComponent(inc.id)}`)}
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
          <div className="flex flex-col xl:flex-row items-center gap-3">
            <div className="w-full xl:w-[52%] xl:min-w-[190px] xl:shrink-0 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie
                  data={threatDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={44}
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
            </div>
            <div className="w-full xl:flex-1 min-w-0 space-y-1.5">
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

      {/* Row: Status distribution + Top recurring causes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="dash-card">
          <div className="dash-card-header">
            <span className="section-title">Case Status Distribution</span>
            <span className="dash-card-period">live</span>
          </div>
          {statusDistribution.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-12">No incident data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" outerRadius={75} innerRadius={48} dataKey="value" strokeWidth={2} stroke="#fff">
                  {statusDistribution.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
            {statusDistribution.map((d) => (
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
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate">{c.name}</span>
                      <span className="tabular-nums font-medium text-muted-foreground">{c.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(c.value / max) * 100}%` }} />
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
            <table className="w-full min-w-[560px] text-sm">
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
                    <td className="py-3 px-5 font-medium tabular-nums">
                      <button
                        type="button"
                        onClick={() => navigate(`/incidents/${inc.id}`)}
                        className="text-primary hover:underline underline-offset-4"
                      >
                        {inc.reference_code || inc.id.slice(0, 8)}
                      </button>
                    </td>
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
      {canIssueCommand && (
        <div className="dash-card bg-gradient-to-r from-navy via-accent to-navy text-navy-foreground border-0">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Regulatory Command Panel</p>
                  <p className="text-[11px] text-navy-foreground/75 max-w-[46ch]">Quick actions for incident response and enforcement across active cases.</p>
                </div>
              </div>
              <div className="text-[11px] text-navy-foreground/75 sm:text-right">
                <p>{eligibleIncidents.length} active incidents available</p>
                {role === "analyst" && <p>Lockdown protocol is administrator-only</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              <Button size="sm" onClick={() => openCommand("dispatch_team")} disabled={!canIssueCommand || !eligibleIncidents.length} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 disabled:opacity-50">
                <Send className="h-3.5 w-3.5 mr-1.5" /> Dispatch Team
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openCommand("escalate_alert")} disabled={!canIssueCommand || !eligibleIncidents.length} className="w-full bg-navy-foreground/10 text-navy-foreground border border-navy-foreground/20 hover:bg-navy-foreground/15 h-9 disabled:opacity-50">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Escalate Alert
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openCommand("lockdown_protocol")} disabled={role !== "admin" || !eligibleIncidents.length} className="w-full bg-navy-foreground/10 text-navy-foreground border border-navy-foreground/20 hover:bg-navy-foreground/15 h-9 disabled:opacity-50">
                <Lock className="h-3.5 w-3.5 mr-1.5" /> Lockdown Protocol
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openCommand("request_reinforcement")} disabled={!canIssueCommand || !eligibleIncidents.length} className="w-full bg-navy-foreground/10 text-navy-foreground border border-navy-foreground/20 hover:bg-navy-foreground/15 h-9 disabled:opacity-50">
                <PhoneCall className="h-3.5 w-3.5 mr-1.5" /> Request Reinforcement
              </Button>
            </div>
          </div>
        </div>
      )}

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
            <Button variant={selectedAction === "lockdown_protocol" ? "destructive" : "default"} onClick={issueCommand} disabled={isIssuingCommand || !selectedIncidentId || commandInstructions.trim().length < 5}>
              {isIssuingCommand ? "Issuing…" : `Issue ${activeCommand?.label ?? "Command"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
