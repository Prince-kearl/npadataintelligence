
-- Case status enum
DO $$ BEGIN
  CREATE TYPE public.case_status AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cases table
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  status public.case_status NOT NULL DEFAULT 'open',
  directorate TEXT NOT NULL DEFAULT 'SECURITY AND INTELLIGENCE',
  hod_name TEXT,
  hod_email TEXT NOT NULL,
  escalation_notes TEXT,
  resolution_notes TEXT,
  opened_by UUID REFERENCES auth.users(id),
  opened_by_email TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by UUID REFERENCES auth.users(id),
  closed_by_email TEXT,
  closed_at TIMESTAMPTZ,
  email_status TEXT DEFAULT 'pending',
  email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cases_incident_id_idx ON public.cases(incident_id);
CREATE INDEX IF NOT EXISTS cases_status_idx ON public.cases(status);

GRANT SELECT, INSERT, UPDATE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- All signed-in staff can read cases (so real-time broadcast reaches everyone)
CREATE POLICY "Signed-in staff can view cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (public.is_active_user(auth.uid()));

-- Only admins can create/update cases
CREATE POLICY "Admins can create cases"
  ON public.cases FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update cases"
  ON public.cases FOR UPDATE
  TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_active_user(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER cases_set_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Escalation RPC
CREATE OR REPLACE FUNCTION public.escalate_incident(
  _incident_id UUID,
  _hod_email TEXT,
  _hod_name TEXT DEFAULT NULL,
  _directorate TEXT DEFAULT 'SECURITY AND INTELLIGENCE',
  _notes TEXT DEFAULT NULL
)
RETURNS public.cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.cases;
  v_incident public.incidents;
  v_email TEXT;
  v_meta JSONB;
BEGIN
  IF NOT public.is_active_user(auth.uid()) OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Active administrator required';
  END IF;
  IF _hod_email IS NULL OR btrim(_hod_email) = '' OR _hod_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid recipient email is required';
  END IF;

  SELECT * INTO v_incident FROM public.incidents WHERE id = _incident_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.cases (
    incident_id, status, directorate, hod_email, hod_name, escalation_notes,
    opened_by, opened_by_email
  ) VALUES (
    _incident_id, 'open',
    COALESCE(NULLIF(btrim(_directorate), ''), 'SECURITY AND INTELLIGENCE'),
    btrim(_hod_email),
    NULLIF(btrim(_hod_name), ''),
    NULLIF(btrim(_notes), ''),
    auth.uid(), v_email
  ) RETURNING * INTO v_case;

  v_meta := jsonb_build_object(
    'case_id', v_case.id,
    'incident_id', v_incident.id,
    'reference_code', v_incident.reference_code,
    'directorate', v_case.directorate,
    'hod_email', v_case.hod_email
  );

  -- Notify reporter, analysts, and admins
  IF v_incident.reporter_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, category, metadata)
    VALUES (v_incident.reporter_id,
      'Incident escalated as a case',
      format('%s has been escalated to %s.', COALESCE(v_incident.reference_code, v_incident.id::text), v_case.directorate),
      'case', v_meta);
  END IF;
  PERFORM public.notify_role_members('analyst', 'Case opened',
    format('%s escalated to %s.', COALESCE(v_incident.reference_code, v_incident.id::text), v_case.directorate),
    'case', v_meta, auth.uid());
  PERFORM public.notify_role_members('admin', 'Case opened',
    format('%s escalated to %s.', COALESCE(v_incident.reference_code, v_incident.id::text), v_case.directorate),
    'case', v_meta, auth.uid());

  -- Audit
  INSERT INTO public.audit_logs (user_id, user_email, action, table_name, record_id, details, new_values)
  VALUES (auth.uid(), v_email, 'escalate_incident', 'cases', v_case.id::text, v_meta, to_jsonb(v_case));

  RETURN v_case;
END;
$$;

-- Close case RPC
CREATE OR REPLACE FUNCTION public.close_case(
  _case_id UUID,
  _resolution TEXT
)
RETURNS public.cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.cases;
  v_email TEXT;
  v_incident public.incidents;
  v_meta JSONB;
BEGIN
  IF NOT public.is_active_user(auth.uid()) OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Active administrator required';
  END IF;
  IF length(btrim(COALESCE(_resolution, ''))) < 5 THEN
    RAISE EXCEPTION 'Resolution feedback must contain at least 5 characters';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.cases
     SET status = 'closed',
         resolution_notes = btrim(_resolution),
         closed_by = auth.uid(),
         closed_by_email = v_email,
         closed_at = now(),
         updated_at = now()
   WHERE id = _case_id AND status = 'open'
  RETURNING * INTO v_case;

  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found or already closed'; END IF;

  SELECT * INTO v_incident FROM public.incidents WHERE id = v_case.incident_id;
  v_meta := jsonb_build_object(
    'case_id', v_case.id,
    'incident_id', v_case.incident_id,
    'reference_code', v_incident.reference_code
  );

  IF v_incident.reporter_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, category, metadata)
    VALUES (v_incident.reporter_id, 'Case resolved',
      format('Case for %s has been closed.', COALESCE(v_incident.reference_code, v_incident.id::text)),
      'case', v_meta);
  END IF;
  PERFORM public.notify_role_members('analyst', 'Case closed',
    format('Case for %s closed.', COALESCE(v_incident.reference_code, v_incident.id::text)),
    'case', v_meta, auth.uid());
  PERFORM public.notify_role_members('admin', 'Case closed',
    format('Case for %s closed.', COALESCE(v_incident.reference_code, v_incident.id::text)),
    'case', v_meta, auth.uid());

  INSERT INTO public.audit_logs (user_id, user_email, action, table_name, record_id, details, new_values)
  VALUES (auth.uid(), v_email, 'close_case', 'cases', v_case.id::text, v_meta, to_jsonb(v_case));

  RETURN v_case;
END;
$$;

-- Mark cases.email_status after edge function reports back
CREATE OR REPLACE FUNCTION public.mark_case_email_sent(
  _case_id UUID,
  _status TEXT,
  _error TEXT DEFAULT NULL
)
RETURNS public.cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_case public.cases;
BEGIN
  IF NOT public.is_active_user(auth.uid()) OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Active administrator required';
  END IF;
  UPDATE public.cases
     SET email_status = COALESCE(_status, email_status),
         email_error = _error,
         updated_at = now()
   WHERE id = _case_id
  RETURNING * INTO v_case;
  RETURN v_case;
END;
$$;

-- Enable realtime broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
