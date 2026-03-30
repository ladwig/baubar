-- ============================================================
-- Allow the Gateway service (anon key, no user session) to upload
-- voice messages into the {org_id}/voice/ prefix of the report-images bucket.
--
-- Audio files are stored permanently (unlike temp/ images which get moved).
-- The transcription is stored in gateway.messages.content.
-- ============================================================

CREATE POLICY "gateway can upload to voice folder"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'report-images'
    AND (storage.foldername(name))[2] = 'voice'
  );
