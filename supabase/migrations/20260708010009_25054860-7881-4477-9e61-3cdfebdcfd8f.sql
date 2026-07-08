
-- ============================================================
-- Security hardening: RLS tightening + SECURITY DEFINER lockdown
-- ============================================================

-- 1) audit_logs: remove permissive INSERT policy; only definer paths write
DROP POLICY IF EXISTS "Authenticated insert audit logs" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated, anon;

-- 2) incident_status_history: restrict SELECT to rows for incidents the user
--    can already see (owner OR analyst/admin)
DROP POLICY IF EXISTS "Status history: visible to authenticated" ON public.incident_status_history;
CREATE POLICY "Status history: visible per incident access"
  ON public.incident_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_status_history.incident_id
        AND i.deleted_at IS NULL
        AND (
          i.reporter_id = auth.uid()
          OR public.has_role(auth.uid(), 'analyst'::app_role)
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

-- 3) incident_attachments: also verify the referenced incident is accessible
DROP POLICY IF EXISTS "Attachments: authenticated can insert" ON public.incident_attachments;
CREATE POLICY "Attachments: insert only for accessible incidents"
  ON public.incident_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.incidents i
      WHERE i.id = incident_attachments.incident_id
        AND i.deleted_at IS NULL
        AND (
          i.reporter_id = auth.uid()
          OR public.has_role(auth.uid(), 'analyst'::app_role)
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

-- 4) storage.objects: add explicit UPDATE policy for incident-attachments bucket
DROP POLICY IF EXISTS "Owners update own incident files" ON storage.objects;
CREATE POLICY "Owners update own incident files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'incident-attachments'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'analyst'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'incident-attachments'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'analyst'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 5) SECURITY DEFINER lockdown:
--    a) Revoke EXECUTE from PUBLIC + anon on ALL public-schema SECURITY DEFINER
--       functions (nothing here should be reachable unauthenticated).
--    b) Revoke from authenticated on trigger-only / internal helpers.
--    c) Grant EXECUTE back to authenticated only for user-callable RPCs.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      r.schema, r.proname, r.args
    );
  END LOOP;
END $$;

-- Trigger-only / internal helpers: no authenticated grant needed
DO $$
DECLARE
  fn text;
  r record;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'audit_incident_change',
    'handle_new_user',
    'notify_incident_events',
    'notify_response_action_events',
    'notify_role_members',
    'record_incident_status_change',
    'current_role_level'
  ])
  LOOP
    FOR r IN
      SELECT pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated',
        fn, r.args
      );
    END LOOP;
  END LOOP;
END $$;

-- User-callable RPCs: (re)grant EXECUTE to authenticated
DO $$
DECLARE
  fn text;
  r record;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'admin_set_account_status',
    'admin_set_user_role',
    'close_case',
    'create_incident_response_action',
    'create_self_notification',
    'delete_incident_record',
    'escalate_incident',
    'get_unread_notifications_count',
    'has_role',
    'is_active_user',
    'list_deleted_incidents',
    'mark_all_notifications_read',
    'mark_case_email_sent',
    'mark_notification_read',
    'restore_incident_record',
    'update_incident_details',
    'update_query_template'
  ])
  LOOP
    FOR r IN
      SELECT pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
        fn, r.args
      );
    END LOOP;
  END LOOP;
END $$;
