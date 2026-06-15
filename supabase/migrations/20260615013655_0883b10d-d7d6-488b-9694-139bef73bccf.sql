
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('collector', 'analyst', 'admin');
CREATE TYPE public.account_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE public.incident_status AS ENUM ('New', 'Reviewed', 'Closed');

-- ============= UTIL: updated_at =============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  department text,
  status public.account_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============= SECURITY DEFINER: has_role =============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_role_level()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'analyst' THEN 2 ELSE 3 END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'active')
$$;

-- ============= PROFILE POLICIES =============
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own basic profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============= USER ROLES POLICIES =============
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= AUTO-CREATE PROFILE ON SIGNUP =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first;

  INSERT INTO public.profiles (id, email, full_name, department, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'department', ''),
    CASE WHEN is_first THEN 'active'::public.account_status ELSE 'pending'::public.account_status END
  );

  -- Bootstrap: first user becomes admin so the system has an operator
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'collector');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= INCIDENTS =============
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text UNIQUE,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name text,
  department text,
  incident_date date NOT NULL,
  region text NOT NULL,
  district text,
  location_name text NOT NULL,
  gps_coordinates text,
  category text NOT NULL,
  incident_type text,
  description text NOT NULL,
  product_type text,
  injury_type text,
  casualties integer NOT NULL DEFAULT 0,
  fatalities integer NOT NULL DEFAULT 0,
  source text,
  source_contact text,
  source_notes text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.incident_status NOT NULL DEFAULT 'New',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE INDEX incidents_reporter_idx ON public.incidents(reporter_id);
CREATE INDEX incidents_date_idx ON public.incidents(incident_date DESC);
CREATE INDEX incidents_region_idx ON public.incidents(region);
CREATE INDEX incidents_category_idx ON public.incidents(category);
CREATE INDEX incidents_status_idx ON public.incidents(status);

CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-generate reference_code like INC-2026-000123
CREATE SEQUENCE IF NOT EXISTS public.incidents_seq START 1000;
CREATE OR REPLACE FUNCTION public.assign_incident_reference()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reference_code IS NULL THEN
    NEW.reference_code := 'INC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.incidents_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER incidents_assign_ref BEFORE INSERT ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.assign_incident_reference();

-- Incident policies
CREATE POLICY "Active collectors create incidents" ON public.incidents
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = reporter_id AND public.is_active_user(auth.uid())
  );
CREATE POLICY "Collectors read own incidents" ON public.incidents
  FOR SELECT TO authenticated USING (
    deleted_at IS NULL AND reporter_id = auth.uid()
  );
CREATE POLICY "Analyst/Admin read all incidents" ON public.incidents
  FOR SELECT TO authenticated USING (
    deleted_at IS NULL AND (
      public.has_role(auth.uid(), 'analyst') OR public.has_role(auth.uid(), 'admin')
    )
  );
CREATE POLICY "Analyst/Admin update incidents" ON public.incidents
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'analyst') OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admin delete incidents" ON public.incidents
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============= AUDIT LOG =============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX audit_logs_created_idx ON public.audit_logs(created_at DESC);
CREATE INDEX audit_logs_user_idx ON public.audit_logs(user_id);

CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Audit trigger for incidents
CREATE OR REPLACE FUNCTION public.audit_incident_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_action text;
  v_record_id text;
  v_details jsonb;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_action := 'create_incident'; v_record_id := NEW.id::text;
    v_details := jsonb_build_object('reference_code', NEW.reference_code, 'category', NEW.category, 'region', NEW.region);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update_incident'; v_record_id := NEW.id::text;
    v_details := jsonb_build_object('reference_code', NEW.reference_code, 'old_status', OLD.status, 'new_status', NEW.status);
  ELSE
    v_action := 'delete_incident'; v_record_id := OLD.id::text;
    v_details := jsonb_build_object('reference_code', OLD.reference_code);
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, table_name, record_id, details)
  VALUES (auth.uid(), v_email, v_action, 'incidents', v_record_id, v_details);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER incidents_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.audit_incident_change();
