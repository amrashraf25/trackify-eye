
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sent_by uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'behavior_warning',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Students can view their own notifications
CREATE POLICY "Students can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM students s WHERE s.user_id = auth.uid()
    )
  );

-- Students can update (mark as read) their own notifications
CREATE POLICY "Students can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM students s WHERE s.user_id = auth.uid()
    )
  );

-- Doctors and deans can insert notifications
CREATE POLICY "Staff can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'dean'::app_role)
    OR has_role(auth.uid(), 'doctor'::app_role)
  );

-- Staff can view notifications they sent
CREATE POLICY "Staff can view sent notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'dean'::app_role)
    OR has_role(auth.uid(), 'doctor'::app_role)
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
