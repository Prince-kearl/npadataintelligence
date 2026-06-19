import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Users, Activity, Loader2, FileClock } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ROLE_LABELS, type Role } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";

type AccountStatus = "pending" | "active" | "suspended";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  status: AccountStatus;
  created_at: string;
  role: Role | null;
}

async function fetchUsers(): Promise<AdminUser[]> {
  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name,department,status,created_at").order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id,role"),
  ]);
  if (pErr) throw pErr;
  if (rErr) throw rErr;
  const roleMap = new Map<string, Role>();
  const priority: Record<Role, number> = { admin: 1, analyst: 2, collector: 3 };
  for (const r of roles ?? []) {
    const cur = roleMap.get(r.user_id);
    if (!cur || priority[r.role as Role] < priority[cur]) roleMap.set(r.user_id, r.role as Role);
  }
  return (profiles ?? []).map((p) => ({ ...(p as any), role: roleMap.get(p.id) ?? null }));
}

async function fetchAuditLogs() {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw error;
  return data;
}

async function fetchAuthEvents() {
  const { data, error } = await supabase
    .from("auth_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

const roleClass: Record<string, string> = {
  admin: "text-destructive",
  analyst: "text-accent",
  collector: "text-info",
};
const statusClass: Record<string, string> = {
  active: "bg-success/10 text-success",
  suspended: "bg-muted text-muted-foreground",
  pending: "bg-warning/10 text-warning",
};

export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: fetchUsers });
  const { data: audit = [] } = useQuery({ queryKey: ["audit-logs"], queryFn: fetchAuditLogs });
  const { data: authEvents = [] } = useQuery({ queryKey: ["auth-events"], queryFn: fetchAuthEvents });

  const updateStatus = async (id: string, status: AccountStatus) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Account ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const setUserRole = async (userId: string, newRole: Role) => {
    const { error } = await supabase.rpc("admin_set_user_role", { _user_id: userId, _role: newRole });
    if (error) return toast.error(error.message);
    toast.success(`Role set to ${ROLE_LABELS[newRole]}`);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const counts = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    pending: users.filter((u) => u.status === "pending").length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Admin Panel</h1>
        <p className="meta-text mt-1">User management, roles, approvals, and audit oversight.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Users" value={counts.total} icon={Users} iconBg="bg-accent/10" iconClass="text-accent" />
        <KPICard title="Active Accounts" value={counts.active} icon={Activity} iconBg="bg-success/10" iconClass="text-success" />
        <KPICard title="Pending Approvals" value={counts.pending} icon={Shield} iconBg="bg-warning/10" iconClass="text-warning" />
      </div>

      <div className="dash-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="section-title">User Accounts</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="data-table-header text-left py-3 px-4">Name</th>
                  <th className="data-table-header text-left py-3 px-4">Email</th>
                  <th className="data-table-header text-left py-3 px-4">Role</th>
                  <th className="data-table-header text-left py-3 px-4">Department</th>
                  <th className="data-table-header text-left py-3 px-4">Status</th>
                  <th className="data-table-header text-left py-3 px-4">Joined</th>
                  <th className="data-table-header text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{u.full_name || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-4">
                      <Select disabled={u.id === currentUser?.id} value={u.role ?? ""} onValueChange={(v) => setUserRole(u.id, v as Role)}>
                        <SelectTrigger className="h-8 w-32 text-xs bg-muted/50 border-border rounded-lg">
                          <SelectValue placeholder="Set role">
                            {u.role ? <span className={`font-medium ${roleClass[u.role]}`}>{ROLE_LABELS[u.role]}</span> : "No role"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="collector">Collector</SelectItem>
                          <SelectItem value="analyst">Analyst</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{u.department || "—"}</td>
                    <td className="py-3 px-4">
                      <Badge className={statusClass[u.status]} variant="secondary">{u.status}</Badge>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {u.id !== currentUser?.id && u.status !== "active" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(u.id, "active")}>Approve</Button>
                        )}
                        {u.id !== currentUser?.id && u.status !== "suspended" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(u.id, "suspended")}>Suspend</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="dash-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <FileClock className="h-4 w-4 text-primary" />
          <h3 className="section-title">Recent Activity (Audit Log)</h3>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="data-table-header text-left py-2 px-4">When</th>
                <th className="data-table-header text-left py-2 px-4">User</th>
                <th className="data-table-header text-left py-2 px-4">Action</th>
                <th className="data-table-header text-left py-2 px-4">Record</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No activity yet.</td></tr>
              )}
              {audit.map((a: any) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-2 px-4 tabular-nums text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="py-2 px-4 text-muted-foreground">{a.user_email || "system"}</td>
                  <td className="py-2 px-4 font-medium">{a.action}</td>
                  <td className="py-2 px-4 text-muted-foreground">{a.details?.reference_code || a.record_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dash-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="section-title">Authentication Events</h3>
          <span className="text-xs text-muted-foreground ml-auto">Last 50 sign-in attempts</span>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="data-table-header text-left py-2 px-4">When</th>
                <th className="data-table-header text-left py-2 px-4">Email</th>
                <th className="data-table-header text-left py-2 px-4">Event</th>
                <th className="data-table-header text-left py-2 px-4">Result</th>
                <th className="data-table-header text-left py-2 px-4">IP</th>
                <th className="data-table-header text-left py-2 px-4">User Agent</th>
              </tr>
            </thead>
            <tbody>
              {authEvents.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No authentication events recorded yet.</td></tr>
              )}
              {authEvents.map((e: any) => (
                <tr key={e.id} className="border-b border-border/50">
                  <td className="py-2 px-4 tabular-nums text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="py-2 px-4 text-muted-foreground">{e.email || "—"}</td>
                  <td className="py-2 px-4 font-medium">{e.event_type}</td>
                  <td className="py-2 px-4">
                    <Badge variant="secondary" className={e.event_type === "login_success" ? "bg-success/10 text-success" : "bg-info/10 text-info"}>
                      {e.event_type === "login_success" ? "Success" : "Recorded"}
                    </Badge>
                  </td>
                  <td className="py-2 px-4 tabular-nums text-muted-foreground">{e.ip_address || "—"}</td>
                  <td className="py-2 px-4 text-muted-foreground truncate max-w-xs" title={e.user_agent}>{e.user_agent || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
