-- Notification preferences and unread notification counters backed by Supabase.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_alerts boolean NOT NULL DEFAULT true,
  email_alerts boolean NOT NULL DEFAULT true,
  sms_critical boolean NOT NULL DEFAULT false,
  notify_on_new_incident boolean NOT NULL DEFAULT true,
  notify_on_status_change boolean NOT NULL DEFAULT true,
  daily_summary boolean NOT NULL DEFAULT false,
  quiet_hours boolean NOT NULL DEFAULT false,
  quiet_hours_start time NOT NULL DEFAULT '22:00',
  quiet_hours_end time NOT NULL DEFAULT '06:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read)
  WHERE is_read = false;

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
  ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_unread_notifications_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.notifications
  WHERE user_id = auth.uid() AND is_read = false
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.notifications
    SET is_read = true,
        read_at = now()
    WHERE user_id = auth.uid()
      AND is_read = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unread_notifications_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_notifications_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

NOTIFY pgrst, 'reload schema';
