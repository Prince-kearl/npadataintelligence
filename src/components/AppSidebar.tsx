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
  Bell,
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

const systemNav = [
  { to: "/admin", icon: Shield, label: "Admin" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar h-screen sticky top-0 transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-[68px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="h-8 w-8 shrink-0 rounded-lg bg-primary flex items-center justify-center">
          <img src={npaLogo} alt="NPA" className="h-6 w-6" />
        </div>
        {!collapsed && (
          <span className="text-sm font-bold text-foreground tracking-tight">NPA System</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {mainNav.map((item) => (
          <SidebarNavLink key={item.to} {...item} collapsed={collapsed} />
        ))}

        <div className="my-4 border-t border-sidebar-border" />

        {systemNav.map((item) => (
          <SidebarNavLink key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <button className="flex items-center gap-3 px-3 py-2 w-full text-sm text-sidebar-foreground/60 hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
          <Bell className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Notifications</span>}
          {!collapsed && (
            <span className="ml-auto h-5 min-w-[20px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">3</span>
          )}
        </button>
        <button className="flex items-center gap-3 px-3 py-2 w-full text-sm text-sidebar-foreground/60 hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-2 text-sidebar-foreground/40 hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
