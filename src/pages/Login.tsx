import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import npaLogoStandard from "@/assets/npa-logo-standard.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const pendingNotice = (location.state as any)?.pending;

  useEffect(() => {
    if (!loading && user && profile?.status === "active") {
      navigate("/", { replace: true });
    }
  }, [loading, user, profile, navigate]);

  const logEvent = async (event_type: "login_success") => {
    try {
      await supabase.functions.invoke("log-auth-event", {
        body: { event_type },
      });
    } catch {
      /* non-fatal */
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setIsLoading(false);
      toast.error(error.message);
      return;
    }
    // Check account status
    const { data: prof } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user!.id)
      .maybeSingle();
    setIsLoading(false);
    if (!prof || prof.status === "pending") {
      await supabase.auth.signOut();
      toast.warning("Your account is awaiting administrator approval.");
      return;
    }
    if (prof.status === "suspended") {
      await supabase.auth.signOut();
      toast.error("Your account has been suspended. Contact an administrator.");
      return;
    }
    await logEvent("login_success");
    toast.success("Welcome back");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
              <img src={npaLogoStandard} alt="NPA Logo" className="h-16 sm:h-20 max-w-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Consumer Data Intelligence System
            </h1>
            <p className="meta-text mt-2">
              Authorized personnel only. Please sign in with your work credentials.
            </p>
          </div>
        </div>

        {pendingNotice && (
          <Alert className="border-warning/40 bg-warning/10">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <AlertDescription className="text-xs">
              Your account is still pending approval by a System Administrator.
            </AlertDescription>
          </Alert>
        )}

        <div className="dash-card">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="label-text">Work Email</Label>
              <Input id="login-email" type="email" placeholder="name@npa.gov.gh" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password" className="label-text">Password</Label>
              <Input id="login-password" type="password" placeholder="Enter your password" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
            </div>
            <Button variant="default" className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="meta-text text-center mt-4">
            No account yet?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Request access
            </Link>
          </p>
        </div>

        <p className="meta-text text-center">
          © 2026 National Petroleum Authority. All rights reserved.
        </p>
      </div>
    </div>
  );
}
