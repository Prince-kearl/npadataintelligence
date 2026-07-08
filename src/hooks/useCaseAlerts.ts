import { useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Subscribes to real-time case escalations and pushes a toast to every online
 * user. Also invalidates notification/case queries so lists refresh instantly.
 */
export function useCaseAlerts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const casesChannel = supabase
      .channel("cases-broadcast")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cases" },
        (payload) => {
          const row = payload.new as {
            id: string;
            incident_id: string;
            directorate: string;
            opened_by: string | null;
            opened_by_email: string | null;
          };
          qc.invalidateQueries({ queryKey: ["cases"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
          // Don't self-notify the escalator
          if (row.opened_by === user.id) return;
          toast.warning("New case escalated", {
            description: `Routed to ${row.directorate}${row.opened_by_email ? ` by ${row.opened_by_email}` : ""}.`,
            action: {
              label: "View incident",
              onClick: () => navigate(`/incidents/${row.incident_id}`),
            },
            duration: 8000,
          });
        },
      )
      .subscribe();

    const notificationsChannel = supabase
      .channel(`notifications-user-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(casesChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [user, qc, navigate]);
}
