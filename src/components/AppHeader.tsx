import { Bell, User, ShieldCheck, Menu } from "lucide-react";
import { useRole, ROLE_LABELS } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useUnreadNotificationsCount } from "@/hooks/useNotifications";

export function AppHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const { role } = useRole();
  const { profile } = useAuth();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const navigate = useNavigate();
  const roleLabel = role ? ROLE_LABELS[role] : "No role";
  const displayName = profile?.full_name || profile?.email || "User";

  return (
    <header className="h-14 bg-navy text-navy-foreground flex items-center justify-between px-3 sm:px-6 sticky top-0 z-50 shadow-md isolate gap-2">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button type="button" onClick={onMenuClick} aria-label="Open navigation" className="lg:hidden h-10 w-10 -ml-1 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0">
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-xs sm:text-sm font-medium text-navy-foreground/90 truncate">
          Consumer Data Intelligence System
        </h2>
      </div>

      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-navy-foreground/60">
            Active Role
          </span>
          <div
            role="status"
            aria-label={`Active role: ${roleLabel}`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-navy-foreground/10 border border-navy-foreground/15 text-xs font-semibold text-navy-foreground cursor-default select-none"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-navy-foreground/70" />
            <span>{roleLabel}</span>
          </div>
        </div>

        <button
          aria-label="Notifications"
          onClick={() => navigate("/notifications")}
          className="relative h-9 w-9 rounded-lg hover:bg-navy-foreground/10 hidden sm:flex items-center justify-center transition-colors"
        >
          <Bell className="h-4 w-4 text-navy-foreground/80" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center tabular-nums">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 sm:pl-2 sm:border-l border-navy-foreground/20"
          aria-label="Open profile"
        >
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="hidden lg:flex flex-col leading-tight">
            <span className="text-[10px] text-navy-foreground/60">Welcome,</span>
            <span className="text-xs font-semibold text-navy-foreground">{displayName}</span>
          </div>
        </button>
      </div>
    </header>
  );
}
