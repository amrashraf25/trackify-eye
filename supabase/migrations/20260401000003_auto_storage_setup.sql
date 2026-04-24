-- ============================================================
-- Auto-create the assignment-files storage bucket via a
-- SECURITY DEFINER function. Any authenticated user can call
-- this RPC — it runs with elevated privileges so it can
-- insert into storage.buckets without needing service role.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_assignment_files_bucket()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'assignment-files',
    'assignment-files',
    true,
    52428800,
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream'
    ]
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Grant execute to all authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_assignment_files_bucket() TO authenticated;

-- Storage RLS policies for the bucket
-- (safe to run multiple times with IF NOT EXISTS)
DO $$
BEGIN
  -- Authenticated users can upload
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload assignment files'
  ) THEN
    CREATE POLICY "Authenticated users can upload assignment files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'assignment-files');
  END IF;

  -- Public can read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public can read assignment files'
  ) THEN
    CREATE POLICY "Public can read assignment files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'assignment-files');
  END IF;

  -- Uploaders can delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Uploaders can delete assignment files'
  ) THEN
    CREATE POLICY "Uploaders can delete assignment files"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'assignment-files' AND auth.uid() = owner);
  END IF;
END;
$$;
