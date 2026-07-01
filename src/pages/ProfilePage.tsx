import { useEffect, useMemo, useState } from "react";
import { UserCircle2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRole, ROLE_LABELS } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, profile, refresh } = useAuth();
  const { role } = useRole();
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setDepartment(profile?.department ?? "");
  }, [profile]);

  const statusClass = useMemo(() => {
    if (profile?.status === "active") return "bg-success/10 text-success";
    if (profile?.status === "pending") return "bg-warning/10 text-warning";
    return "bg-muted text-muted-foreground";
  }, [profile?.status]);

  const saveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          department: department.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refresh();
      toast.success("Profile updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="page-title">Profile</h1>
        <p className="meta-text mt-1">Manage your account identity and working details.</p>
      </div>

      <section className="dash-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <UserCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{profile?.full_name || profile?.email || "User account"}</p>
              <p className="text-sm text-muted-foreground">{profile?.email || "No email"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={statusClass}>{profile?.status || "unknown"}</Badge>
            {role && (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                {ROLE_LABELS[role]}
              </Badge>
            )}
          </div>
        </div>
      </section>

      <section className="dash-card p-5 space-y-4">
        <h2 className="section-title">Account Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Work Email</Label>
            <Input id="email" value={profile?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full-name">Full Name</Label>
            <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Enter your department" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveProfile} disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
        </div>
      </section>

      <section className="dash-card p-5">
        <p className="text-sm text-muted-foreground">
          Role and account status are managed by system administrators to maintain platform security and audit controls.
        </p>
      </section>
    </div>
  );
}
