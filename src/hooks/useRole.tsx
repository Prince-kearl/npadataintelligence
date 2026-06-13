import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Role = "collector" | "analyst" | "admin";

export const ROLE_LABELS: Record<Role, string> = {
  collector: "Field Data Collector",
  analyst: "Data Analyst",
  admin: "System Administrator",
};

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  can: (perm: Permission) => boolean;
}

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

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    const stored = localStorage.getItem("npa_role") as Role | null;
    return stored ?? "admin";
  });

  useEffect(() => {
    localStorage.setItem("npa_role", role);
  }, [role]);

  const can = (perm: Permission) => ROLE_PERMISSIONS[role].includes(perm);

  return (
    <RoleContext.Provider value={{ role, setRole: setRoleState, can }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
