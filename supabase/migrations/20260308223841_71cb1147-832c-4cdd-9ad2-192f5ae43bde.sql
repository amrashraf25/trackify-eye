
-- Add course_id to doctor_behavior_records for per-course tracking
ALTER TABLE public.doctor_behavior_records 
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id);
