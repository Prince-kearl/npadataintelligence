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
import npaIconWhite from "@/assets/npa-icon-white.png";
import { cn } from "@/lib/utils";

const mainNav = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/submit", icon: FileEdit, label: "Submit Incident" },
  { to: "/records", icon: Database, label: "Records" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/reports", icon: FileText, label: "Reports" },
];

const systemNav = [
  { to: "/admin", icon: Shield, label: "Admin Panel" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar h-screen sticky top-0 transition-all duration-300",
        collapsed ? "w-[64px]" : "w-[230px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-navy-foreground/10 flex items-center justify-center p-1">
          <img src={npaIcon} alt="NPA" className="h-7 w-7" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold text-navy-foreground tracking-tight">NPA</span>
            <span className="text-[10px] text-sidebar-foreground/60">Data Intelligence</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {!collapsed && <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/40">Main Menu</p>}
        {mainNav.map((item) => (
          <SidebarNavLink key={item.to} {...item} collapsed={collapsed} />
        ))}

        <div className="my-3 border-t border-sidebar-border" />

        {!collapsed && <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/40">System</p>}
        {systemNav.map((item) => (
          <SidebarNavLink key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <button className="flex items-center gap-3 px-3 py-2 w-full text-sm text-sidebar-foreground/60 hover:text-navy-foreground rounded-lg hover:bg-sidebar-accent transition-colors">
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-2 text-sidebar-foreground/40 hover:text-navy-foreground rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
