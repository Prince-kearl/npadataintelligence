import { useEffect, useState } from "react";
import { Bell, Mail, Smartphone, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMarkAllNotificationsRead, useNotificationsList } from "@/hooks/useNotifications";

interface NotificationSettings {
  inAppAlerts: boolean;
  emailAlerts: boolean;
  smsCritical: boolean;
  notifyOnNewIncident: boolean;
  notifyOnStatusChange: boolean;
  dailySummary: boolean;
  quietHours: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const defaults: NotificationSettings = {
  inAppAlerts: true,
  emailAlerts: true,
  smsCritical: false,
  notifyOnNewIncident: true,
  notifyOnStatusChange: true,
  dailySummary: false,
  quietHours: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "06:00",
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const { data: notifications = [] } = useNotificationsList();
  const markAllRead = useMarkAllNotificationsRead();
  const [settings, setSettings] = useState<NotificationSettings>(defaults);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setIsLoadingPrefs(false);
        return;
      }
      setIsLoadingPrefs(true);
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
        setIsLoadingPrefs(false);
        return;
      }
      if (data) {
        setSettings({
          inAppAlerts: data.in_app_alerts,
          emailAlerts: data.email_alerts,
          smsCritical: data.sms_critical,
          notifyOnNewIncident: data.notify_on_new_incident,
          notifyOnStatusChange: data.notify_on_status_change,
          dailySummary: data.daily_summary,
          quietHours: data.quiet_hours,
          quietHoursStart: data.quiet_hours_start,
          quietHoursEnd: data.quiet_hours_end,
        });
      }
      setIsLoadingPrefs(false);
    };
    void load();
  }, [user]);

  const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!user) return;
    setIsSaving(true);
    const { error } = await supabase.from("notification_preferences").upsert(
      {
        user_id: user.id,
        in_app_alerts: settings.inAppAlerts,
        email_alerts: settings.emailAlerts,
        sms_critical: settings.smsCritical,
        notify_on_new_incident: settings.notifyOnNewIncident,
        notify_on_status_change: settings.notifyOnStatusChange,
        daily_summary: settings.dailySummary,
        quiet_hours: settings.quietHours,
        quiet_hours_start: settings.quietHoursStart,
        quiet_hours_end: settings.quietHoursEnd,
      },
      { onConflict: "user_id" }
    );
    setIsSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Notification preferences saved");
  };

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="page-title">Notifications</h1>
        <p className="meta-text mt-1">Control where and when operational updates reach you.</p>
      </div>

      <section className="dash-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Inbox</h2>
            <p className="text-xs text-muted-foreground mt-1">{unreadCount} unread of {notifications.length} total notifications</p>
          </div>
          <Button variant="outline" disabled={unreadCount === 0 || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            Mark all as read
          </Button>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {notifications.length === 0 && <p className="text-sm text-muted-foreground">No notifications yet.</p>}
          {notifications.map((item) => (
            <div key={item.id} className={`rounded-xl border p-3 ${item.is_read ? "border-border" : "border-primary/40 bg-primary/5"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <span className="text-[11px] text-muted-foreground tabular-nums">{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{item.message}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="section-title">Delivery Channels</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bell className="h-4 w-4 text-primary" />
                In-app alerts
              </div>
              <Switch checked={settings.inAppAlerts} onCheckedChange={(v) => updateSetting("inAppAlerts", v)} />
            </div>
            <p className="text-xs text-muted-foreground">Show real-time notifications in this workspace.</p>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4 text-primary" />
                Email alerts
              </div>
              <Switch checked={settings.emailAlerts} onCheckedChange={(v) => updateSetting("emailAlerts", v)} />
            </div>
            <p className="text-xs text-muted-foreground">Send priority updates to your account email address.</p>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Smartphone className="h-4 w-4 text-primary" />
                SMS critical only
              </div>
              <Switch checked={settings.smsCritical} onCheckedChange={(v) => updateSetting("smsCritical", v)} />
            </div>
            <p className="text-xs text-muted-foreground">Deliver only critical incident escalations by SMS.</p>
          </div>
        </div>
      </section>

      <section className="dash-card p-5 space-y-4">
        <h2 className="section-title">Notification Types</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border p-4 flex items-center justify-between">
            <Label htmlFor="new-incident" className="text-sm">New incident submissions</Label>
            <Switch id="new-incident" checked={settings.notifyOnNewIncident} onCheckedChange={(v) => updateSetting("notifyOnNewIncident", v)} />
          </div>
          <div className="rounded-xl border border-border p-4 flex items-center justify-between">
            <Label htmlFor="status-change" className="text-sm">Incident status changes</Label>
            <Switch id="status-change" checked={settings.notifyOnStatusChange} onCheckedChange={(v) => updateSetting("notifyOnStatusChange", v)} />
          </div>
          <div className="rounded-xl border border-border p-4 flex items-center justify-between">
            <Label htmlFor="daily-summary" className="text-sm">Daily summary digest</Label>
            <Switch id="daily-summary" checked={settings.dailySummary} onCheckedChange={(v) => updateSetting("dailySummary", v)} />
          </div>
        </div>
      </section>

      <section className="dash-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-primary" />
          <h2 className="section-title">Quiet Hours</h2>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border p-4">
          <Label htmlFor="quiet-hours" className="text-sm">Pause non-critical notifications overnight</Label>
          <Switch id="quiet-hours" checked={settings.quietHours} onCheckedChange={(v) => updateSetting("quietHours", v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quiet-start">Start time</Label>
            <Input id="quiet-start" type="time" disabled={!settings.quietHours} value={settings.quietHoursStart} onChange={(e) => updateSetting("quietHoursStart", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiet-end">End time</Label>
            <Input id="quiet-end" type="time" disabled={!settings.quietHours} value={settings.quietHoursEnd} onChange={(e) => updateSetting("quietHoursEnd", e.target.value)} />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={isLoadingPrefs || isSaving}>{isSaving ? "Saving..." : "Save Preferences"}</Button>
      </div>
    </div>
  );
}
