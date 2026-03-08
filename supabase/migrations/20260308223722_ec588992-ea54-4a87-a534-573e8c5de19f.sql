
-- Doctor notifications table for dean alerts to doctors
CREATE TABLE public.doctor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL,
  sent_by UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'behavior_warning',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_notifications ENABLE ROW LEVEL SECURITY;

-- Deans can manage doctor notifications
CREATE POLICY "Deans can manage doctor notifications"
ON public.doctor_notifications
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'dean'))
WITH CHECK (public.has_role(auth.uid(), 'dean'));

-- Admins can view doctor notifications
CREATE POLICY "Admins can view doctor notifications"
ON public.doctor_notifications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Doctors can view their own notifications
CREATE POLICY "Doctors can view own notifications"
ON public.doctor_notifications
FOR SELECT
TO authenticated
USING (doctor_id = auth.uid());
