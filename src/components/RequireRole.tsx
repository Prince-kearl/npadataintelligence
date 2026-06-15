import { Navigate } from "react-router-dom";
import { useRole, Permission, ROLE_LABELS } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { ShieldAlert, Loader2 } from "lucide-react";

interface Props {
  permission: Permission;
  children: React.ReactNode;
  redirect?: string;
}

export function RequireRole({ permission, children, redirect }: Props) {
  const { loading } = useAuth();
  const { can, role } = useRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (can(permission)) return <>{children}</>;
  if (redirect) return <Navigate to={redirect} replace />;
  return (
    <div className="max-w-xl mx-auto mt-12 dash-card text-center space-y-3">
      <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
      <h2 className="page-title">Access Restricted</h2>
      <p className="meta-text">
        Your current role <span className="font-semibold">({role ? ROLE_LABELS[role] : "none assigned"})</span> does
        not have permission to view this page. Contact the System Administrator if you need access.
      </p>
    </div>
  );
}
