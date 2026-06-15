import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import npaLogoStandard from "@/assets/npa-logo-standard.png";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";

export default function SignUp() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, department },
      },
    });
    setIsLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Sign out so they can't access protected routes until approved
    await supabase.auth.signOut();
    setSubmitted(true);
    toast.success("Account requested. Awaiting administrator approval.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={npaLogoStandard} alt="NPA Logo" className="h-20" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Request Access</h1>
          <p className="meta-text">
            All accounts require approval by a System Administrator before activation.
          </p>
        </div>

        {submitted ? (
          <div className="dash-card space-y-4 text-center">
            <Alert className="border-success/40 bg-success/10 text-left">
              <ShieldCheck className="h-4 w-4 text-success" />
              <AlertDescription className="text-xs">
                Your access request has been submitted. You'll receive confirmation once an Administrator approves your account.
              </AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
              Back to Sign In
            </Button>
          </div>
        ) : (
          <div className="dash-card">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label className="label-text">Full Name *</Label>
                <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="bg-muted/50 border-border rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label className="label-text">Work Email *</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@npa.gov.gh" className="bg-muted/50 border-border rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label className="label-text">Department</Label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g., Field Operations" className="bg-muted/50 border-border rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label className="label-text">Password * (min 8 chars)</Label>
                <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-muted/50 border-border rounded-lg" />
              </div>
              <Button variant="default" className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? "Submitting..." : "Request Access"}
              </Button>
            </form>
            <p className="meta-text text-center mt-4">
              Already approved?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
