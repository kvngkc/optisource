-- ════════════════════════════════════════════════════════════════
-- 1. Allow opticians to read product_prices for any supplier
--    (they need it to resolve prices during stock query / order)
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Opticians can read any company product_prices"
  ON product_prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'optician'
    )
  );

CREATE POLICY "Opticians can read any company product_price_ranges"
  ON product_price_ranges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'optician'
    )
  );

-- ════════════════════════════════════════════════════════════════
-- 2. Allow staff to read optician_orders for their company
-- ════════════════════════════════════════════════════════════════
CREATE POLICY "Staff can read company optician_orders"
  ON optician_orders FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('staff', 'manager')
    )
  );

-- ════════════════════════════════════════════════════════════════
-- 3. Manager role — add to profiles role check constraint
--    NOTE: If your profiles table has a CHECK constraint on role,
--    replace it. Otherwise this is a no-op and you only need the
--    RLS policies below.
-- ════════════════════════════════════════════════════════════════

-- Allow manager to read/write transactions for their company
CREATE POLICY "Manager can manage transactions"
  ON transactions FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Allow manager to read/write stock for their company
CREATE POLICY "Manager can manage stock"
  ON stock FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Allow manager to read optician_orders for their company
CREATE POLICY "Manager can manage optician_orders"
  ON optician_orders FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Allow manager to read optician_order_items for their company
CREATE POLICY "Manager can read optician_order_items"
  ON optician_order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM optician_orders
      WHERE company_id IN (
        SELECT company_id FROM profiles
        WHERE id = auth.uid() AND role = 'manager'
      )
    )
  );

-- Allow manager to read/write order_messages
CREATE POLICY "Manager can manage order_messages"
  ON order_messages FOR ALL
  USING (
    order_id IN (
      SELECT id FROM optician_orders
      WHERE company_id IN (
        SELECT company_id FROM profiles
        WHERE id = auth.uid() AND role = 'manager'
      )
    )
  );

-- Allow manager to read debtors for their company
CREATE POLICY "Manager can manage debtors"
  ON debtors FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Allow manager to read debtor_payments for their company
CREATE POLICY "Manager can manage debtor_payments"
  ON debtor_payments FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Allow manager to read audit_log for their company
CREATE POLICY "Manager can read audit_log"
  ON audit_log FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Allow manager to read products, classes, locations, prices
CREATE POLICY "Manager can read products"
  ON products FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Manager can read product_classes"
  ON product_classes FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Manager can read locations"
  ON locations FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Manager can read product_prices"
  ON product_prices FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Manager can read product_price_ranges"
  ON product_price_ranges FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Manager can read customers"
  ON customers FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Manager can insert customers"
  ON customers FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Allow manager to insert audit_log entries
CREATE POLICY "Manager can insert audit_log"
  ON audit_log FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );
