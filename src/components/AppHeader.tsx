import { Search, Bell, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import npaLogoWhite from "@/assets/npa-logo-white.png";

export function AppHeader() {
  return (
    <header className="h-14 bg-navy text-navy-foreground flex items-center justify-between px-6 sticky top-0 z-30 shadow-md">
      <div className="flex items-center gap-4">
        <img src={npaLogoFull} alt="NPA" className="h-8 hidden md:block" />
        <div className="h-6 w-px bg-navy-foreground/20 hidden md:block" />
        <h2 className="text-sm font-medium text-navy-foreground/90">
          Incident & Field Data Intelligence System
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-foreground/50" />
          <Input
            placeholder="Search..."
            className="pl-9 w-52 h-8 bg-navy-foreground/10 border-navy-foreground/20 rounded-lg text-sm text-navy-foreground placeholder:text-navy-foreground/40 focus:bg-navy-foreground/15"
          />
        </div>

        <button className="relative h-8 w-8 rounded-lg hover:bg-navy-foreground/10 flex items-center justify-center transition-colors">
          <Bell className="h-4 w-4 text-navy-foreground/80" />
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">3</span>
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-navy-foreground/20">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-xs font-medium text-navy-foreground">Admin User</span>
            <span className="text-[10px] text-navy-foreground/60">System Administrator</span>
          </div>
        </div>
      </div>
    </header>
  );
}
