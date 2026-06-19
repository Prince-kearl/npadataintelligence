-- Persistent, audited commands issued from the Regulatory Command Panel.

CREATE TYPE public.response_action_type AS ENUM (
  'dispatch_team',
  'escalate_alert',
  'lockdown_protocol',
  'request_reinforcement'
);

CREATE TYPE public.response_action_status AS ENUM (
  'requested',
  'acknowledged',
  'completed',
  'cancelled'
);

CREATE TABLE public.incident_response_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  action_type public.response_action_type NOT NULL,
  status public.response_action_status NOT NULL DEFAULT 'requested',
  priority public.incident_severity NOT NULL,
  instructions text NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX incident_response_actions_incident_idx
  ON public.incident_response_actions(incident_id, created_at DESC);

CREATE TRIGGER incident_response_actions_updated_at
  BEFORE UPDATE ON public.incident_response_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.incident_response_actions TO authenticated;
GRANT ALL ON public.incident_response_actions TO service_role;
ALTER TABLE public.incident_response_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active elevated users read response actions"
  ON public.incident_response_actions FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid()) AND
    (public.has_role(auth.uid(), 'analyst') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE OR REPLACE FUNCTION public.create_incident_response_action(
  _incident_id uuid,
  _action public.response_action_type,
  _instructions text
)
RETURNS public.incident_response_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_incident public.incidents;
  v_email text;
  v_priority public.incident_severity;
  v_action public.incident_response_actions;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Active authentication required';
  END IF;

  v_role := public.current_role_level();
  IF v_role NOT IN ('analyst', 'admin') THEN
    RAISE EXCEPTION 'Analyst or administrator role required';
  END IF;
  IF _action = 'lockdown_protocol' AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators may initiate lockdown protocol';
  END IF;
  IF length(btrim(coalesce(_instructions, ''))) < 5 THEN
    RAISE EXCEPTION 'Operational instructions must contain at least 5 characters';
  END IF;

  SELECT * INTO v_incident FROM public.incidents
  WHERE id = _incident_id
    AND deleted_at IS NULL
    AND submission_state = 'complete'
    AND status NOT IN ('Closed', 'archived');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active incident not found';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  v_priority := CASE
    WHEN _action IN ('escalate_alert', 'lockdown_protocol') THEN 'critical'::public.incident_severity
    WHEN _action IN ('dispatch_team', 'request_reinforcement') THEN 'high'::public.incident_severity
    ELSE v_incident.severity
  END;

  INSERT INTO public.incident_response_actions (
    incident_id, action_type, priority, instructions,
    requested_by, requested_by_email
  ) VALUES (
    _incident_id, _action, v_priority, left(btrim(_instructions), 4000),
    auth.uid(), v_email
  ) RETURNING * INTO v_action;

  INSERT INTO public.audit_logs (
    user_id, user_email, action, table_name, record_id, details, new_values
  ) VALUES (
    auth.uid(), v_email, 'issue_response_command', 'incident_response_actions',
    v_action.id::text,
    jsonb_build_object(
      'reference_code', v_incident.reference_code,
      'incident_id', v_incident.id,
      'action_type', _action,
      'priority', v_priority
    ),
    to_jsonb(v_action)
  );

  RETURN v_action;
END;
$$;

REVOKE ALL ON FUNCTION public.create_incident_response_action(
  uuid, public.response_action_type, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_incident_response_action(
  uuid, public.response_action_type, text
) TO authenticated;
