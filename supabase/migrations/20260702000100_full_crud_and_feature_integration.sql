-- Full CRUD + cross-feature integration for settings and notifications.

-- ======================================================
-- 1) System settings table (admin-managed singleton)
-- ======================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  require_mfa_for_admins boolean NOT NULL DEFAULT true,
  lock_pending_accounts boolean NOT NULL DEFAULT true,
  incident_retention_days integer NOT NULL DEFAULT 365 CHECK (incident_retention_days BETWEEN 30 AND 3650),
  audit_retention_days integer NOT NULL DEFAULT 730 CHECK (audit_retention_days BETWEEN 90 AND 3650),
  scanner_health_alerts boolean NOT NULL DEFAULT true,
  weekly_security_digest boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active admins read app settings" ON public.app_settings;
CREATE POLICY "Active admins read app settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Active admins manage app settings" ON public.app_settings;
CREATE POLICY "Active admins manage app settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ======================================================
-- 2) Notification CRUD completion + safe helper RPCs
-- ======================================================
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications"
  ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_notification_read(_id uuid, _is_read boolean)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notifications;
BEGIN
  UPDATE public.notifications
     SET is_read = _is_read,
         read_at = CASE WHEN _is_read THEN now() ELSE null END
   WHERE id = _id
     AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found or access denied';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_self_notification(
  _title text,
  _message text,
  _category text DEFAULT 'system',
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notifications;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, category, metadata)
  VALUES (auth.uid(), left(coalesce(_title, ''), 160), left(coalesce(_message, ''), 2000), left(coalesce(_category, 'system'), 60), coalesce(_metadata, '{}'::jsonb))
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_read(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_self_notification(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_self_notification(text, text, text, jsonb) TO authenticated;

-- ======================================================
-- 3) Cross-app notification integration via triggers
-- ======================================================
CREATE OR REPLACE FUNCTION public.notify_role_members(
  _role public.app_role,
  _title text,
  _message text,
  _category text DEFAULT 'incident',
  _metadata jsonb DEFAULT '{}'::jsonb,
  _exclude_user uuid DEFAULT null
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, category, metadata)
  SELECT ur.user_id,
         left(coalesce(_title, ''), 160),
         left(coalesce(_message, ''), 2000),
         left(coalesce(_category, 'incident'), 60),
         coalesce(_metadata, '{}'::jsonb)
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    LEFT JOIN public.notification_preferences np ON np.user_id = ur.user_id
   WHERE ur.role = _role
     AND p.status = 'active'
     AND (_exclude_user IS NULL OR ur.user_id <> _exclude_user)
     AND coalesce(np.in_app_alerts, true);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_incident_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_message text;
  v_meta jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'New incident submitted';
    v_message := format('%s in %s requires review.', coalesce(NEW.reference_code, NEW.id::text), NEW.region);
    v_meta := jsonb_build_object('incident_id', NEW.id, 'reference_code', NEW.reference_code, 'category', NEW.category, 'status', NEW.status);

    PERFORM public.notify_role_members('analyst', v_title, v_message, 'incident', v_meta, NEW.reporter_id);
    PERFORM public.notify_role_members('admin', v_title, v_message, 'incident', v_meta, NEW.reporter_id);

    IF NEW.reporter_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, category, metadata)
      VALUES (
        NEW.reporter_id,
        'Incident received',
        format('%s has been recorded and is awaiting review.', coalesce(NEW.reference_code, NEW.id::text)),
        'incident',
        v_meta
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := 'Incident status changed';
    v_message := format('%s moved from %s to %s.', coalesce(NEW.reference_code, NEW.id::text), OLD.status, NEW.status);
    v_meta := jsonb_build_object('incident_id', NEW.id, 'reference_code', NEW.reference_code, 'from_status', OLD.status, 'to_status', NEW.status);

    IF NEW.reporter_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, category, metadata)
      VALUES (NEW.reporter_id, v_title, v_message, 'incident', v_meta);
    END IF;

    PERFORM public.notify_role_members('analyst', v_title, v_message, 'incident', v_meta, auth.uid());
    PERFORM public.notify_role_members('admin', v_title, v_message, 'incident', v_meta, auth.uid());
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_incident_events ON public.incidents;
CREATE TRIGGER trg_notify_incident_events
  AFTER INSERT OR UPDATE OF status ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.notify_incident_events();

CREATE OR REPLACE FUNCTION public.notify_response_action_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident public.incidents;
  v_meta jsonb;
BEGIN
  SELECT * INTO v_incident FROM public.incidents WHERE id = NEW.incident_id;

  v_meta := jsonb_build_object(
    'incident_id', NEW.incident_id,
    'action_id', NEW.id,
    'action_type', NEW.action_type,
    'reference_code', v_incident.reference_code
  );

  IF v_incident.reporter_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, category, metadata)
    VALUES (
      v_incident.reporter_id,
      'Response command issued',
      format('%s: %s command was issued for your incident.', coalesce(v_incident.reference_code, v_incident.id::text), NEW.action_type),
      'response',
      v_meta
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_response_action_events ON public.incident_response_actions;
CREATE TRIGGER trg_notify_response_action_events
  AFTER INSERT ON public.incident_response_actions
  FOR EACH ROW EXECUTE FUNCTION public.notify_response_action_events();

REVOKE ALL ON FUNCTION public.notify_role_members(public.app_role, text, text, text, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_incident_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_response_action_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_role_members(public.app_role, text, text, text, jsonb, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
