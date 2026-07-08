
CREATE OR REPLACE FUNCTION public.notify_incident_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_message text;
  v_meta jsonb;
  v_prev_flag boolean;
  v_prev_channel text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_prev_channel := NEW.previous_channel;
    v_prev_flag := v_prev_channel IS NOT NULL
      AND btrim(v_prev_channel) <> ''
      AND v_prev_channel NOT ILIKE 'None%';

    IF v_prev_flag THEN
      v_title := format('⚠ Duplicate report — previously reported via %s', v_prev_channel);
      v_message := format(
        '%s in %s was already reported via %s. Please review for duplication before opening a new case.',
        coalesce(NEW.reference_code, NEW.id::text), NEW.region, v_prev_channel
      );
    ELSE
      v_title := 'New incident submitted';
      v_message := format('%s in %s requires review.', coalesce(NEW.reference_code, NEW.id::text), NEW.region);
    END IF;

    v_meta := jsonb_build_object(
      'incident_id', NEW.id,
      'reference_code', NEW.reference_code,
      'category', NEW.category,
      'status', NEW.status,
      'previously_reported', v_prev_flag,
      'previous_channel', v_prev_channel
    );

    PERFORM public.notify_role_members('analyst', v_title, v_message, 'incident', v_meta, NEW.reporter_id);
    PERFORM public.notify_role_members('admin', v_title, v_message, 'incident', v_meta, NEW.reporter_id);

    IF NEW.reporter_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, category, metadata)
      VALUES (
        NEW.reporter_id,
        CASE WHEN v_prev_flag THEN 'Incident received — flagged as previously reported' ELSE 'Incident received' END,
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
$function$;
