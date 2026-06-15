import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "collector" | "analyst" | "admin";
export type AccountStatus = "pending" | "active" | "suspended";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  status: AccountStatus;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_PRIORITY: Record<Role, number> = { admin: 1, analyst: 2, collector: 3 };

async function loadProfileAndRole(userId: string): Promise<{ profile: Profile | null; role: Role | null }> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name,department,status").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  let role: Role | null = null;
  if (roles && roles.length) {
    role = roles
      .map((r) => r.role as Role)
      .sort((a, b) => ROLE_PRIORITY[a] - ROLE_PRIORITY[b])[0];
  }
  return { profile: (profile as Profile | null) ?? null, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = async (s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);
    if (s?.user) {
      const { profile, role } = await loadProfileAndRole(s.user.id);
      setProfile(profile);
      setRole(role);
    } else {
      setProfile(null);
      setRole(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    // 1. Register listener first so we never miss an event
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Defer to avoid blocking the auth callback
        setTimeout(async () => {
          const { profile, role } = await loadProfileAndRole(s.user.id);
          setProfile(profile);
          setRole(role);
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });
    // 2. Then load existing session
    supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (user) {
      const { profile, role } = await loadProfileAndRole(user.id);
      setProfile(profile);
      setRole(role);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, role, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
