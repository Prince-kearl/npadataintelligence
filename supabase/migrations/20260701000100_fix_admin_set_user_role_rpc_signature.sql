-- Ensure admin_set_user_role RPC is available in schema cache and supports both argument orders.

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
END;
$$;

-- Compatibility overload for clients/schema cache that resolve arguments in reverse order.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_role public.app_role, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_set_user_role(_user_id, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(public.app_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(public.app_role, uuid) TO authenticated;

-- Refresh PostgREST function cache after migration.
NOTIFY pgrst, 'reload schema';
