-- Drop old policies to avoid conflicts
DROP POLICY IF EXISTS "Public Inserts" ON storage.objects;
DROP POLICY IF EXISTS "Public Select" ON storage.objects;

-- Allow public inserts (so both registered admins and unregistered opticians can send images)
CREATE POLICY "Public Inserts" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'order-attachments');

-- Allow public viewing of images
CREATE POLICY "Public Select" ON storage.objects FOR SELECT 
USING (bucket_id = 'order-attachments');
