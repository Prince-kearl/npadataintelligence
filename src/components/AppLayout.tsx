import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useCaseAlerts } from "@/hooks/useCaseAlerts";

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useCaseAlerts();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="hidden lg:block shrink-0">
        <AppSidebar />
      </div>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(86vw,300px)] p-0 border-0 bg-sidebar [&>button]:text-white">
          <AppSidebar mobile onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 min-w-0 overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
