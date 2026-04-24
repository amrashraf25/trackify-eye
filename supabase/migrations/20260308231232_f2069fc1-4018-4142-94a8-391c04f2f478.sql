
ALTER TABLE public.doctor_attendance DROP CONSTRAINT IF EXISTS doctor_attendance_doctor_id_course_id_date_key;
ALTER TABLE public.doctor_attendance ADD CONSTRAINT doctor_attendance_doctor_course_week_key UNIQUE (doctor_id, course_id, week_number);
