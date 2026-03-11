import { useState } from "react";
import {
  LayoutDashboard,
  FileEdit,
  Database,
  BarChart3,
  FileText,
  Shield,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SidebarNavLink } from "@/components/SidebarNavLink";
import npaLogo from "@/assets/npa-logo.png";
import { cn } from "@/lib/utils";

const mainNav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/submit", icon: FileEdit, label: "Submit Incident" },
  { to: "/records", icon: Database, label: "Records" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/reports", icon: FileText, label: "Reports" },
];

const adminNav = [
  { to: "/admin", icon: Shield, label: "Admin Panel" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-sidebar-border">
        <img src={npaLogo} alt="NPA Logo" className="h-9 w-9 shrink-0 rounded" />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-sidebar-foreground truncate">NPA</span>
            <span className="text-[10px] text-sidebar-foreground/60 truncate">Field Data Intelligence</span>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        <div className="mb-3">
          {!collapsed && <p className="px-3 mb-2 text-[10px] uppercase tracking-widest text-sidebar-muted">Main</p>}
          {mainNav.map((item) => (
            <SidebarNavLink key={item.to} {...item} collapsed={collapsed} />
          ))}
        </div>
        <div>
          {!collapsed && <p className="px-3 mb-2 text-[10px] uppercase tracking-widest text-sidebar-muted">System</p>}
          {adminNav.map((item) => (
            <SidebarNavLink key={item.to} {...item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full gap-2 px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground rounded-md hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
