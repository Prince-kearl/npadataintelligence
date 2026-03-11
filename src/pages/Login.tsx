import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import npaLogoFull from "@/assets/npa-logo-full.png";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Login successful");
      navigate("/");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={npaLogoFull} alt="NPA Logo" className="h-20" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Incident & Field Data Intelligence System
            </h1>
            <p className="meta-text mt-2">
              Authorized personnel only. Please sign in with your work credentials.
            </p>
          </div>
        </div>

        <div className="dash-card">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label className="label-text">Work Email</Label>
              <Input type="email" placeholder="name@npa.gov.gh" required className="bg-muted/50 border-border rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="label-text">Password</Label>
              <Input type="password" placeholder="Enter your password" required className="bg-muted/50 border-border rounded-lg" />
            </div>
            <Button variant="default" className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="meta-text text-center mt-4">
            Contact your system administrator for access.
          </p>
        </div>

        <p className="meta-text text-center">
          © 2026 National Petroleum Authority. All rights reserved.
        </p>
      </div>
    </div>
  );
}
