-- ============================================================
-- Allow the Gateway service (anon key, no user session) to upload
-- images into the {org_id}/temp/ prefix of the report-images bucket.
--
-- Security notes:
--   - The bucket is private — no public read access.
--   - The path structure enforces /temp/ as the second segment, so
--     gateway-uploaded files are isolated from the final report paths.
--   - When the agent attaches images to a report the Web API verifies
--     that temp_path starts with {authenticated_org_id}/temp/ before
--     moving to the final {org_id}/{report_id}/{filename} path.
-- ============================================================

CREATE POLICY "gateway can upload to temp folder"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'report-images'
    AND (storage.foldername(name))[2] = 'temp'
  );
