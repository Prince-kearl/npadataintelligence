-- Security and integrity hardening.
-- The database, not the React client, is the authorization boundary.

CREATE TYPE public.submission_state AS ENUM ('staging', 'complete', 'failed');

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS client_submission_id uuid,
  ADD COLUMN IF NOT EXISTS submission_state public.submission_state NOT NULL DEFAULT 'complete',
  ADD COLUMN IF NOT EXISTS expected_attachments integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS incidents_client_submission_uidx
  ON public.incidents(client_submission_id)
  WHERE client_submission_id IS NOT NULL;

ALTER TABLE public.incident_attachments
  ADD CONSTRAINT incident_attachments_storage_path_key UNIQUE (storage_path);

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_role_level() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_level() TO authenticated;

-- A user may edit their display information, never approval or identity fields.
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Only an administrator may change account status or email';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_security_fields ON public.profiles;
CREATE TRIGGER protect_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, department, status) ON public.profiles TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;

-- Administrative capabilities also stop immediately when an account is suspended.
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins delete profiles" ON public.profiles;
CREATE POLICY "Active admins read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Active admins update other profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin') AND id <> auth.uid())
  WITH CHECK (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin') AND id <> auth.uid());
CREATE POLICY "Active admins delete other profiles" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin') AND id <> auth.uid());

DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Active admins read all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Active admins manage other roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid())
  WITH CHECK (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

-- Scan results can only be written by a service-role request (auth.uid() is null).
CREATE OR REPLACE FUNCTION public.protect_attachment_scan_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    NEW.scan_status IS DISTINCT FROM OLD.scan_status OR
    NEW.scan_notes IS DISTINCT FROM OLD.scan_notes
  ) THEN
    RAISE EXCEPTION 'Attachment scan results are server-managed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_attachment_scan_fields ON public.incident_attachments;
CREATE TRIGGER protect_attachment_scan_fields
  BEFORE UPDATE ON public.incident_attachments
  FOR EACH ROW EXECUTE FUNCTION public.protect_attachment_scan_fields();

-- Include an RPC-supplied note in the trigger-created history row.
CREATE OR REPLACE FUNCTION public.record_incident_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_note text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    v_note := nullif(current_setting('app.status_note', true), '');
    INSERT INTO public.incident_status_history
      (incident_id, from_status, to_status, changed_by, changed_by_email, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), v_email, v_note);
  END IF;
  RETURN NEW;
END;
$$;

-- Remove direct incident mutation. Controlled RPCs below validate role and transitions.
DROP POLICY IF EXISTS "Analyst/Admin update incidents" ON public.incidents;
DROP POLICY IF EXISTS "Active collectors create incidents" ON public.incidents;
DROP POLICY IF EXISTS "Collectors read own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Analyst/Admin read all incidents" ON public.incidents;
DROP POLICY IF EXISTS "Admin delete incidents" ON public.incidents;

REVOKE INSERT, UPDATE ON public.incidents FROM authenticated;

CREATE POLICY "Active collectors read own incidents" ON public.incidents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND public.is_active_user(auth.uid()) AND reporter_id = auth.uid()
  );

CREATE POLICY "Active elevated users read all incidents" ON public.incidents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND public.is_active_user(auth.uid()) AND
    (public.has_role(auth.uid(), 'analyst') OR public.has_role(auth.uid(), 'admin'))
  );
CREATE POLICY "Active admins delete incidents" ON public.incidents FOR DELETE TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.begin_incident_submission(
  _submission_id uuid,
  _payload jsonb,
  _expected_attachments integer DEFAULT 0
)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.incidents;
  v_created public.incidents;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Active authentication required';
  END IF;
  IF _submission_id IS NULL OR _expected_attachments < 0 OR _expected_attachments > 20 THEN
    RAISE EXCEPTION 'Invalid submission identifier or attachment count';
  END IF;

  SELECT * INTO v_existing FROM public.incidents
    WHERE client_submission_id = _submission_id;
  IF FOUND THEN
    IF v_existing.reporter_id <> auth.uid() THEN
      RAISE EXCEPTION 'Submission identifier is already in use';
    END IF;
    RETURN v_existing;
  END IF;

  IF coalesce(_payload->>'incident_date', '') = '' OR
     coalesce(_payload->>'region', '') = '' OR
     coalesce(_payload->>'location_name', '') = '' OR
     coalesce(_payload->>'category', '') = '' OR
     coalesce(_payload->>'description', '') = '' THEN
    RAISE EXCEPTION 'Missing required incident fields';
  END IF;

  INSERT INTO public.incidents (
    client_submission_id, submission_state, expected_attachments,
    reporter_id, reporter_name, department, incident_date, region, district,
    location_name, gps_coordinates, category, incident_type, severity,
    description, product_type, injury_type, casualties, fatalities, source,
    source_contact, source_notes, previous_channel, verification_score,
    verification_notes, attachments, status
  ) VALUES (
    _submission_id, 'staging', _expected_attachments,
    auth.uid(), _payload->>'reporter_name', nullif(_payload->>'department', ''),
    (_payload->>'incident_date')::date, _payload->>'region', nullif(_payload->>'district', ''),
    _payload->>'location_name', nullif(_payload->>'gps_coordinates', ''),
    _payload->>'category', nullif(_payload->>'incident_type', ''),
    coalesce((_payload->>'severity')::public.incident_severity, 'medium'),
    _payload->>'description', nullif(_payload->>'product_type', ''),
    nullif(_payload->>'injury_type', ''),
    greatest(coalesce((_payload->>'casualties')::integer, 0), 0),
    greatest(coalesce((_payload->>'fatalities')::integer, 0), 0),
    nullif(_payload->>'source', ''), nullif(_payload->>'source_contact', ''),
    nullif(_payload->>'source_notes', ''), nullif(_payload->>'previous_channel', ''),
    (_payload->>'verification_score')::integer, nullif(_payload->>'verification_notes', ''),
    '[]'::jsonb, 'draft'
  ) RETURNING * INTO v_created;
  RETURN v_created;
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
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Administrators cannot change their own role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_incident_submission(_incident_id uuid)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inc public.incidents;
  v_count integer;
  v_unclean integer;
BEGIN
  SELECT * INTO v_inc FROM public.incidents WHERE id = _incident_id FOR UPDATE;
  IF NOT FOUND OR v_inc.reporter_id <> auth.uid() OR NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Submission not found or access denied';
  END IF;
  IF v_inc.submission_state = 'complete' THEN RETURN v_inc; END IF;

  SELECT count(*), count(*) FILTER (WHERE scan_status <> 'clean')
    INTO v_count, v_unclean
    FROM public.incident_attachments WHERE incident_id = _incident_id;
  IF v_count <> v_inc.expected_attachments OR v_unclean <> 0 THEN
    RAISE EXCEPTION 'All expected attachments must pass malware scanning before submission';
  END IF;

  PERFORM set_config('app.status_note', 'Evidence complete and server-scanned', true);
  UPDATE public.incidents
    SET status = 'submitted', submission_state = 'complete'
    WHERE id = _incident_id RETURNING * INTO v_inc;
  RETURN v_inc;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_incident_status(
  _incident_id uuid,
  _to_status public.incident_status,
  _note text DEFAULT NULL
)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inc public.incidents;
  v_role public.app_role;
  v_allowed boolean := false;
BEGIN
  IF NOT public.is_active_user(auth.uid()) THEN RAISE EXCEPTION 'Active account required'; END IF;
  v_role := public.current_role_level();
  IF v_role NOT IN ('analyst', 'admin') THEN RAISE EXCEPTION 'Insufficient role'; END IF;
  SELECT * INTO v_inc FROM public.incidents WHERE id = _incident_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found'; END IF;

  v_allowed := CASE
    WHEN v_role = 'analyst' THEN
      (v_inc.status = 'submitted' AND _to_status = 'under_review') OR
      (v_inc.status = 'under_review' AND _to_status IN ('returned', 'verified')) OR
      (v_inc.status = 'returned' AND _to_status = 'under_review') OR
      (v_inc.status = 'New' AND _to_status = 'Reviewed')
    WHEN v_role = 'admin' THEN
      (v_inc.status = 'submitted' AND _to_status = 'under_review') OR
      (v_inc.status = 'under_review' AND _to_status IN ('returned', 'verified')) OR
      (v_inc.status = 'returned' AND _to_status = 'under_review') OR
      (v_inc.status = 'verified' AND _to_status = 'Closed') OR
      (v_inc.status = 'Closed' AND _to_status = 'archived') OR
      (v_inc.status = 'New' AND _to_status IN ('Reviewed', 'Closed')) OR
      (v_inc.status = 'Reviewed' AND _to_status = 'Closed')
    ELSE false
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition from % to % is not allowed for role %', v_inc.status, _to_status, v_role;
  END IF;

  PERFORM set_config('app.status_note', coalesce(left(_note, 2000), ''), true);
  UPDATE public.incidents SET status = _to_status WHERE id = _incident_id RETURNING * INTO v_inc;
  RETURN v_inc;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_incident_submission(uuid, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_incident_submission(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_incident_status(uuid, public.incident_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_incident_submission(uuid, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_incident_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_incident_status(uuid, public.incident_status, text) TO authenticated;

-- Audit rows are trigger/service generated only.
DROP POLICY IF EXISTS "Authenticated insert audit logs" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated;

-- Status history is visible only when the incident itself is visible.
DROP POLICY IF EXISTS "Status history: visible to authenticated" ON public.incident_status_history;
DROP POLICY IF EXISTS "Status history: authenticated can insert" ON public.incident_status_history;
REVOKE INSERT ON public.incident_status_history FROM authenticated;
CREATE POLICY "Status history follows incident access" ON public.incident_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id));

-- Attachment metadata follows incident visibility and active-account state.
DROP POLICY IF EXISTS "Attachments: collectors see their own" ON public.incident_attachments;
DROP POLICY IF EXISTS "Attachments: authenticated can insert" ON public.incident_attachments;
DROP POLICY IF EXISTS "Attachments: owners and elevated can update" ON public.incident_attachments;
CREATE POLICY "Attachments follow incident access" ON public.incident_attachments
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.incidents i WHERE i.id = incident_id
  ));
CREATE POLICY "Active owners register pending attachments" ON public.incident_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid()) AND uploaded_by = auth.uid() AND scan_status = 'pending' AND
    EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id AND i.reporter_id = auth.uid() AND i.submission_state = 'staging')
  );
CREATE POLICY "Owners update attachment metadata" ON public.incident_attachments
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND uploaded_by = auth.uid())
  WITH CHECK (public.is_active_user(auth.uid()) AND uploaded_by = auth.uid());

-- Ensure the private bucket exists on a fresh deployment.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('incident-attachments', 'incident-attachments', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

DROP POLICY IF EXISTS "Auth users upload incident files" ON storage.objects;
DROP POLICY IF EXISTS "Owners read own incident files" ON storage.objects;
DROP POLICY IF EXISTS "Analyst/Admin read all incident files" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete own incident files" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete any incident files" ON storage.objects;

CREATE POLICY "Active users upload quarantined evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incident-attachments' AND public.is_active_user(auth.uid()) AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Active owners resume quarantined uploads" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'incident-attachments' AND public.is_active_user(auth.uid()) AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'incident-attachments' AND public.is_active_user(auth.uid()) AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users read clean authorized evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'incident-attachments' AND public.is_active_user(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.incident_attachments a
      JOIN public.incidents i ON i.id = a.incident_id
      WHERE a.storage_path = name AND a.scan_status = 'clean' AND (
        i.reporter_id = auth.uid() OR public.has_role(auth.uid(), 'analyst') OR public.has_role(auth.uid(), 'admin')
      )
    )
  );
CREATE POLICY "Owners delete staged evidence" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'incident-attachments' AND public.is_active_user(auth.uid()) AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Suspended accounts cannot use shared/query/export operational data.
DROP POLICY IF EXISTS "Templates: owner or shared visible" ON public.query_templates;
DROP POLICY IF EXISTS "Templates: owner inserts" ON public.query_templates;
DROP POLICY IF EXISTS "Templates: owner updates" ON public.query_templates;
DROP POLICY IF EXISTS "Templates: owner deletes" ON public.query_templates;
CREATE POLICY "Active users see own or shared templates" ON public.query_templates FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND (owner_id = auth.uid() OR is_shared));
CREATE POLICY "Active owners insert templates" ON public.query_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND owner_id = auth.uid());
CREATE POLICY "Active owners update templates" ON public.query_templates FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND owner_id = auth.uid())
  WITH CHECK (public.is_active_user(auth.uid()) AND owner_id = auth.uid());
CREATE POLICY "Active owners delete templates" ON public.query_templates FOR DELETE TO authenticated
  USING (public.is_active_user(auth.uid()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS "Export history: users see own, admins see all" ON public.export_history;
DROP POLICY IF EXISTS "Export history: users insert own" ON public.export_history;
CREATE POLICY "Active users see authorized exports" ON public.export_history FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Active users insert own exports" ON public.export_history FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND user_id = auth.uid());

-- Auth events remain admin-only and require an active administrator.
DROP POLICY IF EXISTS "Auth events: admins read" ON public.auth_events;
CREATE POLICY "Active admins read auth events" ON public.auth_events FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'incidents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
  END IF;
END $$;
