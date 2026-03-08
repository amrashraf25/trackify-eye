-- Allow admins and deans to delete courses
CREATE POLICY "Admins and deans can delete courses"
ON public.courses
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role));

-- Allow admins and deans to delete students
CREATE POLICY "Admins and deans can delete students"
ON public.students
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role));

-- Allow admins and deans to delete enrollments
CREATE POLICY "Admins and deans can delete enrollments"
ON public.enrollments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role));

-- Allow admins and deans to delete profiles (for doctor removal)
CREATE POLICY "Admins and deans can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'dean'::app_role));