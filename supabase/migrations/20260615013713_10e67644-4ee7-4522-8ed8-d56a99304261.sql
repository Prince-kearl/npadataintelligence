
-- Storage policies for incident-attachments bucket
CREATE POLICY "Auth users upload incident files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incident-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners read own incident files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'incident-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Analyst/Admin read all incident files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'incident-attachments' AND (
      public.has_role(auth.uid(), 'analyst') OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Owners delete own incident files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'incident-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins delete any incident files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'incident-attachments' AND public.has_role(auth.uid(), 'admin'));
