
-- ============================================
-- 1. Behavior Records (history of all actions)
-- ============================================
CREATE TABLE public.behavior_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  recorded_by UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'positive' or 'negative'
  action_name TEXT NOT NULL, -- e.g. 'Smoking during lecture'
  score_change INTEGER NOT NULL, -- e.g. -15 or +5
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_behavior_records_student ON public.behavior_records(student_id);
CREATE INDEX idx_behavior_records_course ON public.behavior_records(course_id);
CREATE INDEX idx_behavior_records_created ON public.behavior_records(created_at DESC);

ALTER TABLE public.behavior_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage behavior records"
  ON public.behavior_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dean') OR has_role(auth.uid(), 'doctor'));

CREATE POLICY "Students can view own behavior records"
  ON public.behavior_records FOR SELECT TO authenticated
  USING (student_id IN (SELECT s.id FROM students s WHERE s.user_id = auth.uid()));

-- ============================================
-- 2. Behavior Scores (current score per student)
-- ============================================
CREATE TABLE public.behavior_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE UNIQUE,
  score INTEGER NOT NULL DEFAULT 100 CHECK (score >= 0 AND score <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_behavior_scores_student ON public.behavior_scores(student_id);

ALTER TABLE public.behavior_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all behavior scores"
  ON public.behavior_scores FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dean') OR has_role(auth.uid(), 'doctor'));

CREATE POLICY "Staff can update behavior scores"
  ON public.behavior_scores FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dean') OR has_role(auth.uid(), 'doctor'));

CREATE POLICY "Staff can insert behavior scores"
  ON public.behavior_scores FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dean') OR has_role(auth.uid(), 'doctor'));

CREATE POLICY "Students can view own behavior score"
  ON public.behavior_scores FOR SELECT TO authenticated
  USING (student_id IN (SELECT s.id FROM students s WHERE s.user_id = auth.uid()));

-- ============================================
-- 3. Doctor Attendance (using profiles system)
-- ============================================
CREATE TABLE public.doctor_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late')),
  marked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doctor_id, course_id, date)
);

CREATE INDEX idx_doctor_attendance_doctor ON public.doctor_attendance(doctor_id);
CREATE INDEX idx_doctor_attendance_date ON public.doctor_attendance(date);

ALTER TABLE public.doctor_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and deans can manage doctor attendance"
  ON public.doctor_attendance FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dean'));

CREATE POLICY "Doctors can view own attendance"
  ON public.doctor_attendance FOR SELECT TO authenticated
  USING (doctor_id = auth.uid());

-- ============================================
-- 4. Add status constraint to attendance_records
-- ============================================
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS marked_by UUID;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS recognition_method TEXT DEFAULT 'manual';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS confidence_score NUMERIC;

-- ============================================
-- 5. Recognition log for face recognition attempts
-- ============================================
CREATE TABLE public.recognition_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  recognized BOOLEAN NOT NULL DEFAULT false,
  confidence_score NUMERIC,
  attempt_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recognition_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage recognition logs"
  ON public.recognition_log FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'dean') OR has_role(auth.uid(), 'doctor'));

-- ============================================
-- 6. Trigger: auto-update behavior_scores when behavior_records inserted
-- ============================================
CREATE OR REPLACE FUNCTION public.update_behavior_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_score INTEGER;
  new_score INTEGER;
BEGIN
  -- Get or create current score
  SELECT score INTO current_score FROM behavior_scores WHERE student_id = NEW.student_id;
  
  IF current_score IS NULL THEN
    INSERT INTO behavior_scores (student_id, score) VALUES (NEW.student_id, 100);
    current_score := 100;
  END IF;
  
  -- Calculate new score, clamped between 0 and 100
  new_score := GREATEST(0, LEAST(100, current_score + NEW.score_change));
  
  UPDATE behavior_scores SET score = new_score, updated_at = now() WHERE student_id = NEW.student_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_behavior_score
  AFTER INSERT ON public.behavior_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_behavior_score();

-- ============================================
-- 7. Initialize behavior scores for existing students
-- ============================================
INSERT INTO public.behavior_scores (student_id, score)
SELECT id, 100 FROM public.students
ON CONFLICT (student_id) DO NOTHING;

-- ============================================
-- 8. Enable realtime for key tables
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.behavior_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.behavior_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recognition_log;
