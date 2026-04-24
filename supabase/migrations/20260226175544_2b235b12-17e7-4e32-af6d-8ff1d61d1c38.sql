
-- Add UPDATE policy on attendance_records for staff
CREATE POLICY "Staff can update attendance" ON public.attendance_records
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role) OR has_role(auth.uid(), 'doctor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role) OR has_role(auth.uid(), 'doctor'::app_role));

-- Add DELETE policy on attendance_records for staff
CREATE POLICY "Staff can delete attendance" ON public.attendance_records
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role) OR has_role(auth.uid(), 'doctor'::app_role));

-- Add week_number column for 16-week tracking
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS week_number integer;

-- Add week_number to doctor_attendance too
ALTER TABLE public.doctor_attendance ADD COLUMN IF NOT EXISTS week_number integer;
