import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

async function fetchUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_notifications_count");
  if (error) throw error;
  return data ?? 0;
}

async function fetchNotifications(): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,title,message,category,metadata,is_read,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as NotificationItem[];
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: fetchUnreadCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useNotificationsList() {
  return useQuery({
    queryKey: ["notifications", "list"],
    queryFn: fetchNotifications,
    staleTime: 15_000,
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("mark_all_notifications_read");
      if (error) throw error;
      return data ?? 0;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
