
-- Drop the restrictive SELECT policies
DROP POLICY IF EXISTS "Admins and deans can view all students" ON public.students;
DROP POLICY IF EXISTS "Doctors can view students in their courses" ON public.students;

-- Recreate as PERMISSIVE so any matching policy grants access
CREATE POLICY "Admins and deans can view all students"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'dean'::app_role)
  );

CREATE POLICY "Doctors can view students in their courses"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'doctor'::app_role)
    AND id IN (
      SELECT e.student_id
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE c.doctor_id = auth.uid()
    )
  );
