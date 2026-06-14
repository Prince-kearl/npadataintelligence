import { Bell, User, ShieldCheck } from "lucide-react";
import { useRole, ROLE_LABELS } from "@/hooks/useRole";

export function AppHeader() {
  const { role } = useRole();
  const roleLabel = ROLE_LABELS[role];

  return (
    <header className="h-14 bg-navy text-navy-foreground flex items-center justify-between px-6 sticky top-0 z-30 shadow-md">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-navy-foreground/90">
          Incident & Field Data Intelligence System
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2">
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

        <button className="relative h-8 w-8 rounded-lg hover:bg-navy-foreground/10 flex items-center justify-center transition-colors">
          <Bell className="h-4 w-4 text-navy-foreground/80" />
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            3
          </span>
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-navy-foreground/20">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-[10px] text-navy-foreground/60">Welcome,</span>
            <span className="text-xs font-semibold text-navy-foreground">{roleLabel}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
