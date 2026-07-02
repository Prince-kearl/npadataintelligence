import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Users, Activity, FileClock } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ROLE_LABELS, type Role } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { ErrorState, LoadingState } from "@/components/ReliabilityState";
import { adminSetAccountStatus } from "@/lib/incidents";

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

const AUDIT_PAGE_SIZE = 8;
const AUTH_EVENTS_PAGE_SIZE = 10;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "The account change could not be completed";
}

function getEdgeInvokeMessage(error: unknown, functionName: string): string {
  const raw = getErrorMessage(error);
  const lowered = raw.toLowerCase();
  if (lowered.includes("failed to send a request to the edge function") || lowered.includes("non-2xx status code")) {
    return `Could not reach Supabase function '${functionName}'. Deploy it in your Lovable/Supabase project and try again.`;
  }
  return raw;
}

export default function AdminPanel() {
  const { user: currentUser, profile } = useAuth();
  const qc = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: fetchUsers });
  const auditQuery = useQuery({ queryKey: ["audit-logs"], queryFn: fetchAuditLogs });
  const authEventsQuery = useQuery({ queryKey: ["auth-events"], queryFn: fetchAuthEvents });
  const { data: users = [], isLoading, isError, error } = usersQuery;
  const { data: audit = [] } = auditQuery;
  const { data: authEvents = [] } = authEventsQuery;
  const [auditPage, setAuditPage] = useState(1);
  const [authEventsPage, setAuthEventsPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<
    | { type: "status"; user: AdminUser; value: AccountStatus }
    | { type: "role"; user: AdminUser; value: Role }
    | null
  >(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteDepartment, setInviteDepartment] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("collector");
  const [inviteStatus, setInviteStatus] = useState<AccountStatus>("pending");
  const [isInviting, setIsInviting] = useState(false);
  const [processingUserActionId, setProcessingUserActionId] = useState<string | null>(null);

  const updateStatus = async (id: string, status: AccountStatus) => {
    await adminSetAccountStatus(id, status);
    toast.success(`Account ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const setUserRole = async (userId: string, newRole: Role) => {
    const { error } = await supabase.rpc("admin_set_user_role", { _user_id: userId, _role: newRole });
    if (error) throw error;
    toast.success(`Role set to ${ROLE_LABELS[newRole]}`);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const confirmUserAction = async () => {
    if (!pendingAction) return;
    if (profile?.status !== "active") {
      toast.error("Only active administrators can change roles or account status");
      setPendingAction(null);
      return;
    }
    setIsUpdating(true);
    try {
      if (pendingAction.type === "status") await updateStatus(pendingAction.user.id, pendingAction.value);
      else await setUserRole(pendingAction.user.id, pendingAction.value);
      setPendingAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const inviteUser = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Enter a valid email");
      return;
    }
    setIsInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-invite-user", {
        body: {
          email,
          full_name: inviteName.trim() || null,
          department: inviteDepartment.trim() || null,
          role: inviteRole,
          status: inviteStatus,
          redirect_to: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Invitation sent to ${email}`);
      setInviteEmail("");
      setInviteName("");
      setInviteDepartment("");
      setInviteRole("collector");
      setInviteStatus("pending");
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (error) {
      toast.error(getEdgeInvokeMessage(error, "admin-invite-user"));
    } finally {
      setIsInviting(false);
    }
  };

  const runUserLifecycleAction = async (userId: string, action: "resend_invite" | "force_password_reset") => {
    setProcessingUserActionId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-actions", {
        body: { user_id: userId, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(action === "resend_invite" ? "Invite resent" : "Password reset email sent");
    } catch (error) {
      toast.error(getEdgeInvokeMessage(error, "admin-user-actions"));
    } finally {
      setProcessingUserActionId(null);
    }
  };

  const counts = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    pending: users.filter((u) => u.status === "pending").length,
  };

  const auditTotalPages = Math.max(1, Math.ceil(audit.length / AUDIT_PAGE_SIZE));
  const authEventsTotalPages = Math.max(1, Math.ceil(authEvents.length / AUTH_EVENTS_PAGE_SIZE));

  useEffect(() => {
    setAuditPage((prev) => Math.min(prev, auditTotalPages));
  }, [auditTotalPages]);

  useEffect(() => {
    setAuthEventsPage((prev) => Math.min(prev, authEventsTotalPages));
  }, [authEventsTotalPages]);

  const auditStart = (auditPage - 1) * AUDIT_PAGE_SIZE;
  const authEventsStart = (authEventsPage - 1) * AUTH_EVENTS_PAGE_SIZE;
  const pagedAudit = audit.slice(auditStart, auditStart + AUDIT_PAGE_SIZE);
  const pagedAuthEvents = authEvents.slice(authEventsStart, authEventsStart + AUTH_EVENTS_PAGE_SIZE);

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

      <div className="dash-card p-5 space-y-4">
        <div>
          <h3 className="section-title">Invite or Create User</h3>
          <p className="meta-text mt-1">Provision a new account, assign initial role, and set approval status.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <Input placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <Input placeholder="Full name (optional)" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          <Input placeholder="Department (optional)" value={inviteDepartment} onChange={(e) => setInviteDepartment(e.target.value)} />
          <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as Role)}>
            <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="collector">Collector</SelectItem>
              <SelectItem value="analyst">Analyst</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={inviteStatus} onValueChange={(value) => setInviteStatus(value as AccountStatus)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button onClick={inviteUser} disabled={isInviting || !inviteEmail.trim()}>
            {isInviting ? "Inviting..." : "Invite User"}
          </Button>
        </div>
      </div>

      <div className="dash-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="section-title">User Accounts</h3>
        </div>
        {isLoading ? (
          <LoadingState label="Loading user accounts…" className="min-h-52 rounded-none border-0 shadow-none" />
        ) : isError ? (
          <ErrorState title="User accounts could not be loaded" error={error} onRetry={() => void usersQuery.refetch()} className="min-h-52 rounded-none border-0" />
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
                      <Select
                        disabled={u.id === currentUser?.id || profile?.status !== "active"}
                        value={u.role ?? ""}
                        onValueChange={(v) => {
                          const nextRole = v as Role;
                          if (u.role === nextRole) return;
                          setPendingAction({ type: "role", user: u, value: nextRole });
                        }}
                      >
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
                      <div className="flex flex-wrap gap-1">
                        {u.id !== currentUser?.id && u.status !== "active" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={profile?.status !== "active"} onClick={() => setPendingAction({ type: "status", user: u, value: "active" })}>Approve</Button>
                        )}
                        {u.id !== currentUser?.id && u.status !== "suspended" && (
                          <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={profile?.status !== "active"} onClick={() => setPendingAction({ type: "status", user: u, value: "suspended" })}>Suspend</Button>
                        )}
                        {u.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={profile?.status !== "active" || processingUserActionId === u.id}
                            onClick={() => runUserLifecycleAction(u.id, "resend_invite")}
                          >
                            Resend invite
                          </Button>
                        )}
                        {u.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={profile?.status !== "active" || processingUserActionId === u.id}
                            onClick={() => runUserLifecycleAction(u.id, "force_password_reset")}
                          >
                            Force reset
                          </Button>
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
          {auditQuery.isLoading && <LoadingState label="Loading audit activity…" className="min-h-36 rounded-none border-0" />}
          {auditQuery.isError && <ErrorState title="Audit activity is unavailable" error={auditQuery.error} onRetry={() => void auditQuery.refetch()} className="min-h-36 rounded-none border-0" />}
          {!auditQuery.isLoading && !auditQuery.isError && (
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
              {pagedAudit.map((a: any) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-2 px-4 tabular-nums text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="py-2 px-4 text-muted-foreground">{a.user_email || "system"}</td>
                  <td className="py-2 px-4 font-medium">{a.action}</td>
                  <td className="py-2 px-4 text-muted-foreground">{a.details?.reference_code || a.record_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
        {!auditQuery.isLoading && !auditQuery.isError && audit.length > AUDIT_PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {auditStart + 1}-{auditStart + pagedAudit.length} of {audit.length}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={auditPage === 1} onClick={() => setAuditPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">Page {auditPage} of {auditTotalPages}</span>
              <Button size="sm" variant="outline" disabled={auditPage === auditTotalPages} onClick={() => setAuditPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="dash-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="section-title">Authentication Events</h3>
          <span className="text-xs text-muted-foreground ml-auto">Last 50 sign-in attempts</span>
        </div>
        <div className="overflow-x-auto overscroll-x-contain">
          {authEventsQuery.isLoading && <LoadingState label="Loading authentication events…" className="min-h-36 rounded-none border-0" />}
          {authEventsQuery.isError && <ErrorState title="Authentication events are unavailable" error={authEventsQuery.error} onRetry={() => void authEventsQuery.refetch()} className="min-h-36 rounded-none border-0" />}
          {!authEventsQuery.isLoading && !authEventsQuery.isError && (
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
              {pagedAuthEvents.map((e: any) => (
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
          )}
        </div>
        {!authEventsQuery.isLoading && !authEventsQuery.isError && authEvents.length > AUTH_EVENTS_PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {authEventsStart + 1}-{authEventsStart + pagedAuthEvents.length} of {authEvents.length}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={authEventsPage === 1} onClick={() => setAuthEventsPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">Page {authEventsPage} of {authEventsTotalPages}</span>
              <Button size="sm" variant="outline" disabled={authEventsPage === authEventsTotalPages} onClick={() => setAuthEventsPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => !open && !isUpdating && setPendingAction(null)}
        title={pendingAction?.type === "role" ? "Change this user’s role?" : pendingAction?.value === "suspended" ? "Suspend this account?" : "Activate this account?"}
        description={pendingAction
          ? pendingAction.type === "role"
            ? `${pendingAction.user.email} will receive ${ROLE_LABELS[pendingAction.value]} permissions immediately.`
            : pendingAction.value === "suspended"
              ? `${pendingAction.user.email} will lose application access immediately.`
              : `${pendingAction.user.email} will be permitted to sign in and use their assigned role.`
          : ""}
        confirmLabel={pendingAction?.type === "role" ? "Change role" : pendingAction?.value === "suspended" ? "Suspend account" : "Activate account"}
        destructive={pendingAction?.type === "status" && pendingAction.value === "suspended"}
        pending={isUpdating}
        onConfirm={confirmUserAction}
      />
    </div>
  );
}
