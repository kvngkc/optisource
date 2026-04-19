-- Drop the previous policy that only allowed authenticated users
DROP POLICY IF EXISTS "Authenticated inserts" ON storage.objects;

-- Allow public inserts so unregistered opticians can upload payment proofs
CREATE POLICY "Public Inserts" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'order-attachments' 
);
