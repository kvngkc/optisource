-- Explicit DELETE policies for all admin settings tables to ensure users can delete data
-- This acts as a fallback / supplement in case previous policies only covered INSERT/UPDATE/SELECT

CREATE POLICY "Admins can delete locations" ON locations FOR DELETE
USING ( company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('company_admin', 'super_admin')) );

CREATE POLICY "Admins can delete products" ON products FOR DELETE
USING ( company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('company_admin', 'super_admin')) );

CREATE POLICY "Admins can delete product classes" ON product_classes FOR DELETE
USING ( company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('company_admin', 'super_admin')) );

CREATE POLICY "Admins can delete product prices" ON product_prices FOR DELETE
USING ( company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('company_admin', 'super_admin')) );

CREATE POLICY "Admins can delete product price ranges" ON product_price_ranges FOR DELETE
USING ( company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('company_admin', 'super_admin')) );

CREATE POLICY "Admins can delete bank accounts" ON company_bank_accounts FOR DELETE
USING ( company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('company_admin', 'super_admin')) );
