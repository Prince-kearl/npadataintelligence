import { Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";

export function AppHeader() {
  return (
    <header className="h-16 bg-background flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Hello, <span className="text-primary">Admin</span> welcome back
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="search"
            className="pl-9 w-56 h-9 bg-card border-border rounded-xl text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <User className="h-4 w-4 text-foreground" />
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-sm font-medium text-foreground">Admin User</span>
          </div>
        </div>
      </div>
    </header>
  );
}
