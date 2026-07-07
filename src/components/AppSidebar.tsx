import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileEdit,
  FileClock,
  Database,
  BarChart3,
  FileText,
  Bell,
  UserCircle2,
  Shield,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SidebarNavLink } from "@/components/SidebarNavLink";
import { cn } from "@/lib/utils";
import npaLogoWhite from "@/assets/npa-logo-white.png";
import { useRole, Permission } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; perm?: Permission };
type AppSidebarProps = { mobile?: boolean; onNavigate?: () => void };

const mainNav: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/submit", icon: FileEdit, label: "Submit Incident", perm: "submit_incident" },
  { to: "/records", icon: Database, label: "Records", perm: "view_own_records" },
  { to: "/analytics", icon: BarChart3, label: "Analytics", perm: "view_analytics" },
  { to: "/reports", icon: FileText, label: "Reports", perm: "view_reports" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/profile", icon: UserCircle2, label: "Profile" },
];

const systemNav: NavItem[] = [
  { to: "/admin", icon: Shield, label: "Admin Panel", perm: "manage_users" },
  { to: "/settings", icon: Settings, label: "Settings", perm: "system_settings" },
];

export function AppSidebar({ mobile = false, onNavigate }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { can } = useRole();
  const { signOut } = useAuth();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const navigate = useNavigate();
  const visibleMain = mainNav.filter((i) => !i.perm || can(i.perm));
  const visibleSystem = systemNav.filter((i) => !i.perm || can(i.perm));

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success("Signed out");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out");
      setIsSigningOut(false);
    }
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar transition-all duration-300",
        mobile ? "h-full w-full" : "h-screen sticky top-0",
        !mobile && (collapsed ? "w-[64px]" : "w-[230px]")
      )}
    >
      <div className={cn("flex items-center justify-center border-b border-sidebar-border", !mobile && collapsed ? "px-2 py-3" : "px-4 py-4")}>
        <img
          src={npaLogoWhite}
          alt="NPA"
          className={cn("w-auto object-contain", !mobile && collapsed ? "h-8" : "h-14")}
        />
      </div>
      <nav className="flex-1 px-3 pt-4 pb-3 space-y-1 overflow-y-auto">
        {(mobile || !collapsed) && <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/40">Main Menu</p>}
        {visibleMain.map((item) => (
          <SidebarNavLink
            key={item.to}
            {...item}
            collapsed={!mobile && collapsed}
            onNavigate={onNavigate}
            badgeCount={item.to === "/notifications" ? unreadCount : undefined}
          />
        ))}

        <div className="my-3 border-t border-sidebar-border" />

        {(mobile || !collapsed) && <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-sidebar-foreground/40">System</p>}
        {visibleSystem.map((item) => (
          <SidebarNavLink key={item.to} {...item} collapsed={!mobile && collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => setConfirmSignOut(true)}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm text-sidebar-foreground/60 hover:text-navy-foreground rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(mobile || !collapsed) && <span>Sign Out</span>}
        </button>
        {!mobile && <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-2 text-sidebar-foreground/40 hover:text-navy-foreground rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>}
      </div>
      <ConfirmationDialog
        open={confirmSignOut}
        onOpenChange={(open) => !isSigningOut && setConfirmSignOut(open)}
        title="Sign out now?"
        description="Any unsaved work on the current page will be lost. Saved drafts will remain available on this device."
        confirmLabel="Sign out"
        pending={isSigningOut}
        onConfirm={handleSignOut}
      />
    </aside>
  );
}
