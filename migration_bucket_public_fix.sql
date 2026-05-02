-- Make the order-attachments bucket public so getPublicUrl works
UPDATE storage.buckets
SET public = true
WHERE id = 'order-attachments';

-- If the bucket somehow doesn't exist yet, create it as public
INSERT INTO storage.buckets (id, name, public)
SELECT 'order-attachments', 'order-attachments', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'order-attachments'
);

-- Ensure public select policy is in place (so anyone with the link can view)
DROP POLICY IF EXISTS "Public Select" ON storage.objects;
CREATE POLICY "Public Select" ON storage.objects FOR SELECT 
USING (bucket_id = 'order-attachments');

-- Ensure public insert policy allows uploads
DROP POLICY IF EXISTS "Public Inserts" ON storage.objects;
CREATE POLICY "Public Inserts" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'order-attachments');
