-- ============================================================
-- Storage: report-images bucket + access policies
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-images',
  'report-images',
  false,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- File path convention: {org_id}/{report_id}/{filename}
-- Policies check that the first folder segment matches the user's org.

CREATE POLICY "org members can upload report images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'report-images'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM project_management.org_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "org members can read report images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'report-images'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM project_management.org_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "org members can delete report images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'report-images'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM project_management.org_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );
