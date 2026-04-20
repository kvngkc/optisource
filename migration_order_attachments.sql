-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('order-attachments', 'order-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Note: Removing the 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY' 
-- because Supabase already handles that, and trying to run it causes the 42501 error!

-- Drop old policies to avoid conflicts (This triggers the yellow warning you saw - it is completely safe to click 'Run this query')
DROP POLICY IF EXISTS "Public Inserts" ON storage.objects;
DROP POLICY IF EXISTS "Public Select" ON storage.objects;

-- Allow public inserts (so both registered admins and unregistered opticians can send images)
CREATE POLICY "Public Inserts" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'order-attachments');

-- Allow public viewing of images
CREATE POLICY "Public Select" ON storage.objects FOR SELECT 
USING (bucket_id = 'order-attachments');
