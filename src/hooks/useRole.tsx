import { useAuth, type Role } from "@/hooks/useAuth";

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
  | "system_settings";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  collector: ["submit_incident", "view_own_records"],
  analyst: [
    "submit_incident",
    "view_all_records",
    "edit_records",
    "export_data",
    "view_analytics",
    "view_reports",
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
    "system_settings",
  ],
};

export function useRole() {
  const { role } = useAuth();
  const can = (perm: Permission) => (role ? ROLE_PERMISSIONS[role].includes(perm) : false);
  return { role, can };
}
