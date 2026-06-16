import { useAuth, type Role } from "@/hooks/useAuth";
import type { IncidentStatus } from "@/lib/incidents";

export type { Role };

export const ROLE_LABELS: Record<Role, string> = {
  collector: "Field Data Collector",
  analyst: "Data Analyst",
  admin: "System Administrator",
};

export type Permission =
  | "submit_incident"
  | "view_own_records"
  | "view_all_records"
  | "edit_records"
  | "export_data"
  | "view_analytics"
  | "view_reports"
  | "manage_users"
  | "view_audit_logs"
  | "view_auth_events"
  | "manage_templates"
  | "system_settings";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  collector: ["submit_incident", "view_own_records", "manage_templates"],
  analyst: [
    "submit_incident",
    "view_all_records",
    "edit_records",
    "export_data",
    "view_analytics",
    "view_reports",
    "manage_templates",
  ],
  admin: [
    "submit_incident",
    "view_all_records",
    "edit_records",
    "export_data",
    "view_analytics",
    "view_reports",
    "manage_users",
    "view_audit_logs",
    "view_auth_events",
    "manage_templates",
    "system_settings",
  ],
};

/** Lifecycle transitions allowed per role. */
const LIFECYCLE_PERMS: Record<Role, IncidentStatus[]> = {
  collector: ["draft", "submitted"],
  analyst: ["draft", "submitted", "under_review", "returned", "verified"],
  admin: ["draft", "submitted", "under_review", "returned", "verified", "Closed", "archived"],
};

export function useRole() {
  const { role } = useAuth();
  const can = (perm: Permission) => (role ? ROLE_PERMISSIONS[role].includes(perm) : false);
  const canSetStatus = (status: IncidentStatus) =>
    role ? LIFECYCLE_PERMS[role].includes(status) : false;
  const allowedStatuses = (): IncidentStatus[] => (role ? LIFECYCLE_PERMS[role] : []);
  return { role, can, canSetStatus, allowedStatuses };
}
