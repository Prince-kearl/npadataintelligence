
-- =========================================
-- ENUMS
-- =========================================
DO $$ BEGIN
  CREATE TYPE public.incident_severity AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attachment_scan_status AS ENUM ('pending','clean','infected','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend existing incident_status enum with lifecycle values (keeps legacy values working)
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'archived';

-- =========================================
-- INCIDENTS: new columns
-- =========================================
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS severity public.incident_severity NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS previous_channel text,
  ADD COLUMN IF NOT EXISTS verification_score integer,
  ADD COLUMN IF NOT EXISTS verification_notes text;

CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_region_district ON public.incidents(region, district);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_product_type ON public.incidents(product_type);

-- =========================================
-- AUDIT LOGS: add old/new values + IP/UA
-- =========================================
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS old_values jsonb,
  ADD COLUMN IF NOT EXISTS new_values jsonb,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- Update audit trigger to capture diffs
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
    v_details := jsonb_build_object('reference_code', NEW.reference_code, 'category', NEW.category, 'region', NEW.region, 'severity', NEW.severity);
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

-- =========================================
-- INCIDENT ATTACHMENTS (multi-file evidence)
-- =========================================
CREATE TABLE IF NOT EXISTS public.incident_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text,
  tags text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  scan_status public.attachment_scan_status NOT NULL DEFAULT 'pending',
  scan_notes text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_incident ON public.incident_attachments(incident_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_attachments TO authenticated;
GRANT ALL ON public.incident_attachments TO service_role;
ALTER TABLE public.incident_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attachments: collectors see their own"
  ON public.incident_attachments FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'analyst')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Attachments: authenticated can insert"
  ON public.incident_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Attachments: owners and elevated can update"
  ON public.incident_attachments FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'analyst')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Attachments: admins delete"
  ON public.incident_attachments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER attachments_updated_at
  BEFORE UPDATE ON public.incident_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- INCIDENT STATUS HISTORY
-- =========================================
CREATE TABLE IF NOT EXISTS public.incident_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  from_status public.incident_status,
  to_status public.incident_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_status_history_incident ON public.incident_status_history(incident_id, created_at DESC);

GRANT SELECT, INSERT ON public.incident_status_history TO authenticated;
GRANT ALL ON public.incident_status_history TO service_role;
ALTER TABLE public.incident_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Status history: visible to authenticated"
  ON public.incident_status_history FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Status history: authenticated can insert"
  ON public.incident_status_history FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- Auto-record status changes
CREATE OR REPLACE FUNCTION public.record_incident_status_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    INSERT INTO public.incident_status_history (incident_id, from_status, to_status, changed_by, changed_by_email)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), v_email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_status_change ON public.incidents;
CREATE TRIGGER trg_incident_status_change
  AFTER UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.record_incident_status_change();

-- =========================================
-- AUTH EVENTS
-- =========================================
CREATE TABLE IF NOT EXISTS public.auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  event_type text NOT NULL,  -- login_success, login_failed, logout, password_reset
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_events_email ON public.auth_events(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON public.auth_events(user_id, created_at DESC);

GRANT SELECT ON public.auth_events TO authenticated;
GRANT ALL ON public.auth_events TO service_role;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth events: admins read"
  ON public.auth_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- EXPORT HISTORY
-- =========================================
CREATE TABLE IF NOT EXISTS public.export_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  format text NOT NULL,         -- csv | excel | sql | pdf | snapshot
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  filters jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_export_history_user ON public.export_history(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.export_history TO authenticated;
GRANT ALL ON public.export_history TO service_role;
ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Export history: users see own, admins see all"
  ON public.export_history FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Export history: users insert own"
  ON public.export_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =========================================
-- QUERY TEMPLATES (saved filter combos)
-- =========================================
CREATE TABLE IF NOT EXISTS public.query_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_query_templates_owner ON public.query_templates(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.query_templates TO authenticated;
GRANT ALL ON public.query_templates TO service_role;
ALTER TABLE public.query_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates: owner or shared visible"
  ON public.query_templates FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR is_shared = true);

CREATE POLICY "Templates: owner inserts"
  ON public.query_templates FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Templates: owner updates"
  ON public.query_templates FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Templates: owner deletes"
  ON public.query_templates FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER query_templates_updated_at
  BEFORE UPDATE ON public.query_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
