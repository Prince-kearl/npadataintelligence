import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listIncidents, type IncidentRow } from "@/lib/incidents";
import { supabase } from "@/integrations/supabase/client";

export function useIncidents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("incident-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery<IncidentRow[]>({
    queryKey: ["incidents"],
    queryFn: listIncidents,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
