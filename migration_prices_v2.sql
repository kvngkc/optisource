CREATE TABLE product_price_ranges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  sph_min numeric,
  sph_max numeric,
  cyl_min numeric,
  cyl_max numeric,
  add_min numeric,
  add_max numeric,
  price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_price_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view their price ranges" ON product_price_ranges FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company admins can manage price ranges" ON product_price_ranges FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND (role = 'company_admin' OR role = 'super_admin'))
);
