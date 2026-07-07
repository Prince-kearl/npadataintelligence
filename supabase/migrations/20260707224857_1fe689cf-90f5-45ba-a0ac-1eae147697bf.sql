
-- 1. Convert incident_response_actions.priority from enum -> text so we can drop the enum
ALTER TABLE public.incident_response_actions
  ALTER COLUMN priority DROP DEFAULT,
  ALTER COLUMN priority TYPE text USING priority::text;

-- 2. Rewrite create_incident_response_action to use text priority (no incident.severity dep)
CREATE OR REPLACE FUNCTION public.create_incident_response_action(_incident_id uuid, _action response_action_type, _instructions text)
 RETURNS incident_response_actions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_incident public.incidents;
  v_email text;
  v_priority text;
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
    AND status NOT IN ('Closed', 'archived');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active incident not found';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  v_priority := CASE
    WHEN _action IN ('escalate_alert', 'lockdown_protocol') THEN 'critical'
    WHEN _action IN ('dispatch_team', 'request_reinforcement') THEN 'high'
    ELSE 'medium'
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
$function$;

-- 3. Rewrite audit_incident_change to no longer reference NEW.severity
CREATE OR REPLACE FUNCTION public.audit_incident_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_action text;
  v_record_id text;
  v_details jsonb;
  v_old jsonb;
  v_new jsonb;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_action := 'create_incident'; v_record_id := NEW.id::text;
    v_details := jsonb_build_object('reference_code', NEW.reference_code, 'category', NEW.category, 'region', NEW.region);
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update_incident'; v_record_id := NEW.id::text;
    v_details := jsonb_build_object('reference_code', NEW.reference_code, 'old_status', OLD.status, 'new_status', NEW.status);
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSE
    v_action := 'delete_incident'; v_record_id := OLD.id::text;
    v_details := jsonb_build_object('reference_code', OLD.reference_code);
    v_old := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, table_name, record_id, details, old_values, new_values)
  VALUES (auth.uid(), v_email, v_action, 'incidents', v_record_id, v_details, v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 4. Rewrite update_incident_details without severity handling
CREATE OR REPLACE FUNCTION public.update_incident_details(_incident_id uuid, _payload jsonb)
 RETURNS incidents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- 5. Drop severity column
ALTER TABLE public.incidents DROP COLUMN IF EXISTS severity;

-- 6. Drop the enum (no remaining references)
DROP TYPE IF EXISTS public.incident_severity;
