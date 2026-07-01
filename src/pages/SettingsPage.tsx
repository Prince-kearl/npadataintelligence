import { useEffect, useState } from "react";
import { Settings as SettingsIcon, ShieldCheck, Database, BellRing } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AdminSettings {
  requireMfaForAdmins: boolean;
  lockPendingAccounts: boolean;
  incidentRetentionDays: number;
  auditRetentionDays: number;
  scannerHealthAlerts: boolean;
  weeklySecurityDigest: boolean;
}

const STORAGE_KEY = "npa.admin.settings.v1";

const defaults: AdminSettings = {
  requireMfaForAdmins: true,
  lockPendingAccounts: true,
  incidentRetentionDays: 365,
  auditRetentionDays: 730,
  scannerHealthAlerts: true,
  weeklySecurityDigest: true,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings>(defaults);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Partial<AdminSettings>;
      setSettings({ ...defaults, ...saved });
    } catch {
      // Ignore malformed local preferences and continue with defaults.
    }
  }, []);

  const updateSetting = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast.success("Settings saved");
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="meta-text mt-1">System configuration controls for security, retention and alerting.</p>
      </div>

      <section className="dash-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="section-title">Security Policy</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-3">
            <Label htmlFor="mfa" className="text-sm">Require MFA for administrators</Label>
            <Switch id="mfa" checked={settings.requireMfaForAdmins} onCheckedChange={(v) => updateSetting("requireMfaForAdmins", v)} />
          </div>
          <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-3">
            <Label htmlFor="pending-lock" className="text-sm">Keep pending accounts locked</Label>
            <Switch id="pending-lock" checked={settings.lockPendingAccounts} onCheckedChange={(v) => updateSetting("lockPendingAccounts", v)} />
          </div>
        </div>
      </section>

      <section className="dash-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="section-title">Data Retention</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="incident-retention">Incident retention (days)</Label>
            <Input
              id="incident-retention"
              type="number"
              min={30}
              max={3650}
              value={settings.incidentRetentionDays}
              onChange={(e) => updateSetting("incidentRetentionDays", Math.max(30, Number(e.target.value) || defaults.incidentRetentionDays))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-retention">Audit retention (days)</Label>
            <Input
              id="audit-retention"
              type="number"
              min={90}
              max={3650}
              value={settings.auditRetentionDays}
              onChange={(e) => updateSetting("auditRetentionDays", Math.max(90, Number(e.target.value) || defaults.auditRetentionDays))}
            />
          </div>
        </div>
      </section>

      <section className="dash-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" />
          <h2 className="section-title">Operational Alerts</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-3">
            <Label htmlFor="scanner-alerts" className="text-sm">Scanner health alerts</Label>
            <Switch id="scanner-alerts" checked={settings.scannerHealthAlerts} onCheckedChange={(v) => updateSetting("scannerHealthAlerts", v)} />
          </div>
          <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-3">
            <Label htmlFor="digest" className="text-sm">Weekly security digest</Label>
            <Switch id="digest" checked={settings.weeklySecurityDigest} onCheckedChange={(v) => updateSetting("weeklySecurityDigest", v)} />
          </div>
        </div>
      </section>

      <div className="dash-card p-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          These controls are workspace preferences for administrators. Core infrastructure secrets and policy enforcement remain managed in Supabase and deployment configuration.
        </p>
        <Button onClick={save} className="shrink-0">
          <SettingsIcon className="h-4 w-4 mr-1" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
