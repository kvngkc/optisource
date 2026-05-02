-- Lock down inserts to authenticated users ONLY
DROP POLICY IF EXISTS "Public Inserts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Inserts" ON storage.objects;

CREATE POLICY "Authenticated Inserts" ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'order-attachments' 
  AND auth.uid() IS NOT NULL
);

-- Ensure the bucket is public so getPublicUrl works
UPDATE storage.buckets
SET public = true
WHERE id = 'order-attachments';

-- If the bucket somehow doesn't exist yet, create it as public
INSERT INTO storage.buckets (id, name, public)
SELECT 'order-attachments', 'order-attachments', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'order-attachments'
);

-- Ensure public select policy is in place
-- (This is safe because our filenames are now unguessable UUIDs)
DROP POLICY IF EXISTS "Public Select" ON storage.objects;
CREATE POLICY "Public Select" ON storage.objects FOR SELECT 
USING (bucket_id = 'order-attachments');
