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
    "view_own_records",
    "view_all_records",
    "edit_records",
    "export_data",
    "view_analytics",
    "view_reports",
    "manage_templates",
  ],
  admin: [
    "submit_incident",
    "view_own_records",
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

const TRANSITIONS: Record<Role, Partial<Record<IncidentStatus, IncidentStatus[]>>> = {
  collector: {},
  analyst: {
    submitted: ["under_review"],
    under_review: ["returned", "verified"],
    returned: ["under_review"],
    New: ["Reviewed"],
  },
  admin: {
    submitted: ["under_review"],
    under_review: ["returned", "verified"],
    returned: ["under_review"],
    verified: ["Closed"],
    Closed: ["archived"],
    New: ["Reviewed", "Closed"],
    Reviewed: ["Closed"],
  },
};

export function useRole() {
  const { role } = useAuth();
  const can = (perm: Permission) => (role ? ROLE_PERMISSIONS[role].includes(perm) : false);
  const allowedTransitions = (from: IncidentStatus): IncidentStatus[] =>
    role ? TRANSITIONS[role][from] ?? [] : [];
  const canTransition = (from: IncidentStatus, to: IncidentStatus) => allowedTransitions(from).includes(to);
  return { role, can, canTransition, allowedTransitions };
}
