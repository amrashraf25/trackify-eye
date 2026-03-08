
-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins and deans can view all students" ON public.students;
DROP POLICY IF EXISTS "Doctors can view students in their courses" ON public.students;

-- Create a security definer function to check if a student is in a doctor's courses
-- This bypasses RLS and breaks the recursion
CREATE OR REPLACE FUNCTION public.is_student_in_doctor_courses(_student_id uuid, _doctor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE e.student_id = _student_id
      AND c.doctor_id = _doctor_id
  )
$$;

-- Recreate the original broad policy for staff (admin, dean, doctor)
CREATE POLICY "Staff can view all students"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'dean'::app_role)
    OR (
      has_role(auth.uid(), 'doctor'::app_role)
      AND is_student_in_doctor_courses(id, auth.uid())
    )
  );
