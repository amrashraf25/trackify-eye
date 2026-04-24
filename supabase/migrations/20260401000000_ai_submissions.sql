-- ============================================================
-- AI SUBMISSIONS SYSTEM
-- ============================================================

-- Assignments table (doctor creates assignments per course)
CREATE TABLE IF NOT EXISTS public.assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  rubric      TEXT,
  max_score   INTEGER NOT NULL DEFAULT 100,
  due_date    TIMESTAMPTZ,
  week_number INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assignments"
  ON public.assignments FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Doctors and admins can manage assignments"
  ON public.assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('doctor', 'admin', 'dean')
    )
  );

-- Submissions table (student submits work)
CREATE TABLE IF NOT EXISTS public.submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id         UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id            UUID REFERENCES public.students(id) ON DELETE CASCADE,
  content               TEXT,
  file_url              TEXT,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Doctor review
  doctor_grade          INTEGER,
  doctor_feedback       TEXT,
  graded_at             TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'submitted'
                          CHECK (status IN ('submitted', 'graded', 'returned')),
  -- AI grading
  ai_grade              INTEGER,
  ai_feedback           TEXT,
  ai_grade_model        TEXT,
  -- Plagiarism detection
  plagiarism_score      NUMERIC(5, 2),
  plagiarism_details    JSONB,
  plagiarism_provider   TEXT,
  -- AI content detection
  ai_detection_score    NUMERIC(5, 2),
  ai_detection_label    TEXT,
  ai_detection_details  JSONB,
  ai_detection_provider TEXT,
  -- Behavior note
  behavior_note         TEXT,
  -- Timestamps
  ai_processed_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own submissions"
  ON public.submissions FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Students can insert own submissions"
  ON public.submissions FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Doctors admins deans can read all submissions"
  ON public.submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('doctor', 'admin', 'dean')
    )
  );

CREATE POLICY "Doctors admins deans can update submissions"
  ON public.submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('doctor', 'admin', 'dean')
    )
  );

-- Realtime for submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
  END IF;
END
$$;
