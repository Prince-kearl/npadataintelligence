import { Navigate } from "react-router-dom";
import { useRole, Permission } from "@/hooks/useRole";
import { ShieldAlert } from "lucide-react";

interface Props {
  permission: Permission;
  children: React.ReactNode;
  redirect?: string;
}

export function RequireRole({ permission, children, redirect }: Props) {
  const { can, role } = useRole();
  if (can(permission)) return <>{children}</>;
  if (redirect) return <Navigate to={redirect} replace />;
  return (
    <div className="max-w-xl mx-auto mt-12 dash-card text-center space-y-3">
      <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
      <h2 className="page-title">Access Restricted</h2>
      <p className="meta-text">
        Your current role <span className="font-semibold">({role})</span> does not have
        permission to view this page. Contact the System Administrator if you need access.
      </p>
    </div>
  );
}
