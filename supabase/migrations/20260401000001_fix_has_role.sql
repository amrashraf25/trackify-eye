-- ============================================================
-- Fix has_role() to also check profiles.role as fallback
-- This fixes the case where admin/dean users were created via
-- Supabase dashboard and never got a user_roles row.
-- ============================================================

-- 1. Update has_role() to check BOTH user_roles AND profiles.role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role::text
  )
$$;

-- 2. Update get_user_role() to also check profiles.role as fallback
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1),
    (SELECT role::app_role FROM public.profiles WHERE id = _user_id AND role IN ('admin','dean','doctor','student') LIMIT 1)
  )
$$;

-- 3. Backfill user_roles from profiles for existing users who don't have a user_roles row
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, p.role::app_role
FROM public.profiles p
WHERE p.role IN ('admin', 'dean', 'doctor', 'student')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Update handle_new_user trigger to also populate user_roles when role metadata is provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  _role := COALESCE(
    new.raw_user_meta_data ->> 'role',
    'student'
  );

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    _role
  )
  ON CONFLICT (id) DO NOTHING;

  -- Also insert into user_roles if it's a valid app_role
  IF _role IN ('admin', 'dean', 'doctor', 'student') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, _role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- 5. Explicitly add UPDATE policy with WITH CHECK on courses to be safe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'courses'
      AND policyname = 'Admins and deans can update courses'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins and deans can update courses"
      ON public.courses
      FOR UPDATE
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dean'))
      WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dean'))
    $policy$;
  END IF;
END;
$$;
