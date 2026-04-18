-- Create customers table
CREATE TABLE customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users can view their customers" ON customers FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Company users can insert customers" ON customers FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Add customer_id to transactions and debtors
ALTER TABLE transactions Add COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE debtors Add COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;

-- Add image_url to order_messages
ALTER TABLE order_messages Add COLUMN image_url text;

-- Create storage bucket for order-attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('order-attachments', 'order-attachments', true);

-- Allow public read access to the bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'order-attachments');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated inserts" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'order-attachments' 
  AND auth.role() = 'authenticated'
);
