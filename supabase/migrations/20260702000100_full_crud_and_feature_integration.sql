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

-- ======================================================
-- 4) Strict CRUD RPCs for incidents and templates
-- ======================================================
CREATE OR REPLACE FUNCTION public.update_incident_details(
  _incident_id uuid,
  _payload jsonb
)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inc public.incidents;
  v_role public.app_role;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Active account required';
  END IF;

  v_role := public.current_role_level();
  IF v_role NOT IN ('analyst', 'admin') THEN
    RAISE EXCEPTION 'Analyst or administrator role required';
  END IF;

  SELECT * INTO v_inc
    FROM public.incidents
   WHERE id = _incident_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident not found';
  END IF;

  UPDATE public.incidents
     SET location_name = coalesce(nullif(_payload->>'location_name', ''), location_name),
         district = coalesce(nullif(_payload->>'district', ''), district),
         gps_coordinates = nullif(_payload->>'gps_coordinates', ''),
         category = coalesce(nullif(_payload->>'category', ''), category),
         incident_type = nullif(_payload->>'incident_type', ''),
         severity = coalesce((_payload->>'severity')::public.incident_severity, severity),
         product_type = nullif(_payload->>'product_type', ''),
         injury_type = nullif(_payload->>'injury_type', ''),
         casualties = coalesce((_payload->>'casualties')::integer, casualties),
         fatalities = coalesce((_payload->>'fatalities')::integer, fatalities),
         description = coalesce(nullif(_payload->>'description', ''), description),
         source = nullif(_payload->>'source', ''),
         source_contact = nullif(_payload->>'source_contact', ''),
         source_notes = nullif(_payload->>'source_notes', ''),
         previous_channel = nullif(_payload->>'previous_channel', ''),
         updated_at = now()
   WHERE id = _incident_id
  RETURNING * INTO v_inc;

  RETURN v_inc;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_incident_record(
  _incident_id uuid,
  _reason text DEFAULT NULL
)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inc public.incidents;
BEGIN
  IF NOT public.is_active_user(auth.uid()) OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Active administrator required';
  END IF;

  UPDATE public.incidents
     SET deleted_at = now(),
         updated_at = now()
   WHERE id = _incident_id
     AND deleted_at IS NULL
  RETURNING * INTO v_inc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident not found or already deleted';
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, table_name, record_id, details)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'delete_incident_record',
    'incidents',
    _incident_id::text,
    jsonb_build_object('reason', left(coalesce(_reason, ''), 1000), 'reference_code', v_inc.reference_code)
  );

  RETURN v_inc;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_incident_record(
  _incident_id uuid,
  _reason text DEFAULT NULL
)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inc public.incidents;
BEGIN
  IF NOT public.is_active_user(auth.uid()) OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Active administrator required';
  END IF;

  UPDATE public.incidents
     SET deleted_at = NULL,
         updated_at = now()
   WHERE id = _incident_id
     AND deleted_at IS NOT NULL
  RETURNING * INTO v_inc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident not found or not deleted';
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, table_name, record_id, details)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'restore_incident_record',
    'incidents',
    _incident_id::text,
    jsonb_build_object('reason', left(coalesce(_reason, ''), 1000), 'reference_code', v_inc.reference_code)
  );

  RETURN v_inc;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_deleted_incidents(_limit integer DEFAULT 100)
RETURNS SETOF public.incidents
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.incidents
  WHERE deleted_at IS NOT NULL
    AND public.is_active_user(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY deleted_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 100), 500))
$$;

CREATE OR REPLACE FUNCTION public.update_query_template(
  _id uuid,
  _name text,
  _description text,
  _definition jsonb,
  _is_shared boolean
)
RETURNS public.query_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpl public.query_templates;
BEGIN
  UPDATE public.query_templates
     SET name = left(coalesce(nullif(_name, ''), name), 120),
         description = nullif(left(coalesce(_description, ''), 500), ''),
         definition = coalesce(_definition, definition),
         is_shared = coalesce(_is_shared, is_shared),
         updated_at = now()
   WHERE id = _id
     AND owner_id = auth.uid()
  RETURNING * INTO v_tpl;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  RETURN v_tpl;
END;
$$;

-- ======================================================
-- 5) Admin lifecycle RPC with integrated notifications
-- ======================================================
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  _user_id uuid,
  _status public.account_status
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT public.is_active_user(auth.uid()) OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Active administrator required';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Administrators cannot change their own account status';
  END IF;

  UPDATE public.profiles
     SET status = _status,
         updated_at = now()
   WHERE id = _user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, category, metadata)
  VALUES (
    _user_id,
    'Account status updated',
    format('Your account status is now %s.', _status),
    'account',
    jsonb_build_object('status', _status)
  );

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_active_user(auth.uid()) OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Active administrator required';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Administrators cannot change their own role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);

  INSERT INTO public.notifications (user_id, title, message, category, metadata)
  VALUES (
    _user_id,
    'Role permissions updated',
    format('Your operational role is now %s.', _role),
    'account',
    jsonb_build_object('role', _role)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_incident_details(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_incident_record(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_incident_record(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_query_template(uuid, text, text, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, public.account_status) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_incident_details(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_incident_record(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_incident_record(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_deleted_incidents(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_query_template(uuid, text, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, public.account_status) TO authenticated;

DROP POLICY IF EXISTS "Attachments: admins delete" ON public.incident_attachments;
DROP POLICY IF EXISTS "Attachments: owners and elevated delete" ON public.incident_attachments;
CREATE POLICY "Attachments: owners and elevated delete"
  ON public.incident_attachments FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'analyst')
    OR public.has_role(auth.uid(), 'admin')
  );

NOTIFY pgrst, 'reload schema';
