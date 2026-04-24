
-- Drop the old broad policy that lets doctors see ALL students
DROP POLICY IF EXISTS "Staff can view all students" ON public.students;

-- Admins and deans can still see all students
CREATE POLICY "Admins and deans can view all students"
  ON public.students
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'dean'::app_role)
  );

-- Doctors can only see students enrolled in their courses
CREATE POLICY "Doctors can view students in their courses"
  ON public.students
  FOR SELECT
  USING (
    has_role(auth.uid(), 'doctor'::app_role)
    AND id IN (
      SELECT e.student_id
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE c.doctor_id = auth.uid()
    )
  );
