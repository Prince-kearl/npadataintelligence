import { NavLink as RouterNavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SidebarNavLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNavLink({ to, icon: Icon, label, collapsed, onNavigate }: SidebarNavLinkProps) {
  return (
    <RouterNavLink
      to={to}
      onClick={onNavigate}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-sidebar-foreground hover:text-navy-foreground hover:bg-sidebar-accent"
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span>{label}</span>}
    </RouterNavLink>
  );
}
