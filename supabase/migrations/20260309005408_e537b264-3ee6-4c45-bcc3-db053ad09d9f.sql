DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'doctor_notifications'
      AND policyname = 'Doctors can update own notifications'
  ) THEN
    CREATE POLICY "Doctors can update own notifications"
    ON public.doctor_notifications
    FOR UPDATE
    USING (doctor_id = auth.uid())
    WITH CHECK (doctor_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'doctor_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_notifications;
  END IF;
END
$$;