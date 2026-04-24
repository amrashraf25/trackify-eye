
-- Fix overly permissive INSERT on attendance_records
DROP POLICY IF EXISTS "Authenticated can insert attendance" ON public.attendance_records;
CREATE POLICY "Staff can insert attendance" ON public.attendance_records
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role) OR has_role(auth.uid(), 'doctor'::app_role));

-- Fix overly permissive INSERT on incidents
DROP POLICY IF EXISTS "Authenticated users can insert incidents" ON public.incidents;
CREATE POLICY "Staff can insert incidents" ON public.incidents
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role) OR has_role(auth.uid(), 'doctor'::app_role));

-- Fix overly permissive UPDATE on incidents
DROP POLICY IF EXISTS "Authenticated users can update incidents" ON public.incidents;
CREATE POLICY "Staff can update incidents" ON public.incidents
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role) OR has_role(auth.uid(), 'doctor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role) OR has_role(auth.uid(), 'doctor'::app_role));
