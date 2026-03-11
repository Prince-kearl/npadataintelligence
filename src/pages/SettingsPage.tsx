import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="meta-text mt-1">System configuration and preferences.</p>
      </div>

      <div className="kpi-card text-center py-12">
        <SettingsIcon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          System settings will be available once backend integration is connected.
        </p>
      </div>
    </div>
  );
}
