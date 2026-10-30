-- ============================================================
-- Migration: Atomic sale recording (record_sale RPC)
-- Run this in your Supabase SQL Editor (safe to re-run)
--
-- Why: the Sales page used to deduct stock, upsert the customer,
-- insert the transaction and the debtor row as separate HTTP calls.
-- If any call after the stock deduction stalled or failed, stock was
-- gone but no SALE transaction / debtor row existed. This function
-- does all of it inside ONE database transaction: either everything
-- is written, or nothing is.
--
-- SECURITY INVOKER → existing RLS policies still apply to the caller.
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_sale(
  p_company_id     uuid,
  p_product_id     uuid,
  p_location_id    uuid,
  p_sph            text,
  p_cyl            text,
  p_axis           text,
  p_addition       text,
  p_name_key       text,
  p_qty            numeric,
  p_unit_price     numeric,
  p_amount_paid    numeric,
  p_payment_method text,
  p_customer_name  text,
  p_customer_phone text,
  p_notes          text
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total     numeric := round(p_qty * p_unit_price, 2);
  v_paid      numeric := coalesce(p_amount_paid, 0);
  v_balance   numeric;
  v_available numeric;
  v_remaining numeric := p_qty;
  v_take      numeric;
  v_row       record;
  v_customer  uuid;
  v_txn       uuid;
  v_debtor    uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_qty IS NULL OR p_qty < 0.5 OR mod(p_qty, 0.5) <> 0 THEN
    RAISE EXCEPTION 'Qty must be at least 0.5, in steps of 0.5';
  END IF;
  IF p_unit_price IS NULL OR p_unit_price <= 0 THEN
    RAISE EXCEPTION 'Unit price is required';
  END IF;
  IF v_paid > v_total THEN
    RAISE EXCEPTION 'Overpayment blocked — amount paid exceeds total';
  END IF;

  v_balance := v_total - v_paid;
  IF v_balance > 0 AND coalesce(trim(p_customer_name), '') = '' THEN
    RAISE EXCEPTION 'Customer name is required for credit sales';
  END IF;

  -- ── Lock matching stock rows and check availability ──────────
  SELECT coalesce(sum(qty - coalesce(allocated_qty, 0)), 0) INTO v_available
  FROM (
    SELECT qty, allocated_qty FROM stock
    WHERE product_id = p_product_id AND location_id = p_location_id
      AND sph      IS NOT DISTINCT FROM p_sph
      AND cyl      IS NOT DISTINCT FROM p_cyl
      AND axis     IS NOT DISTINCT FROM p_axis
      AND addition IS NOT DISTINCT FROM p_addition
      AND name_key IS NOT DISTINCT FROM p_name_key
    FOR UPDATE
  ) s;

  IF v_available < p_qty THEN
    RAISE EXCEPTION 'Oversell blocked — only % available', v_available;
  END IF;

  -- ── Deduct (highest-qty row first) ───────────────────────────
  FOR v_row IN
    SELECT id, qty, coalesce(allocated_qty, 0) AS allocated_qty FROM stock
    WHERE product_id = p_product_id AND location_id = p_location_id
      AND sph      IS NOT DISTINCT FROM p_sph
      AND cyl      IS NOT DISTINCT FROM p_cyl
      AND axis     IS NOT DISTINCT FROM p_axis
      AND addition IS NOT DISTINCT FROM p_addition
      AND name_key IS NOT DISTINCT FROM p_name_key
    ORDER BY qty DESC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := least(v_row.qty - v_row.allocated_qty, v_remaining);
    CONTINUE WHEN v_take <= 0;
    UPDATE stock SET qty = qty - v_take, updated_at = now() WHERE id = v_row.id;
    v_remaining := v_remaining - v_take;
  END LOOP;

  -- ── Customer ─────────────────────────────────────────────────
  IF coalesce(trim(p_customer_name), '') <> '' OR coalesce(trim(p_customer_phone), '') <> '' THEN
    SELECT id INTO v_customer FROM customers
    WHERE company_id = p_company_id
      AND name  = coalesce(nullif(trim(p_customer_name), ''), 'Unknown')
      AND phone = coalesce(trim(p_customer_phone), '')
    LIMIT 1;

    IF v_customer IS NULL THEN
      INSERT INTO customers (company_id, name, phone)
      VALUES (p_company_id, coalesce(nullif(trim(p_customer_name), ''), 'Unknown'), coalesce(trim(p_customer_phone), ''))
      RETURNING id INTO v_customer;
    END IF;
  END IF;

  -- ── Transaction ──────────────────────────────────────────────
  INSERT INTO transactions (
    company_id, type, product_id, location_id,
    sph, cyl, axis, addition, name_key,
    qty, unit_price, total_amount, amount_paid, balance,
    payment_method, customer_id, notes, created_by
  ) VALUES (
    p_company_id, 'SALE', p_product_id, p_location_id,
    p_sph, p_cyl, p_axis, p_addition, p_name_key,
    p_qty, p_unit_price, v_total, v_paid, nullif(greatest(v_balance, 0), 0),
    p_payment_method, v_customer, nullif(p_notes, ''), auth.uid()
  )
  RETURNING id INTO v_txn;

  -- ── Debtor (update a trigger-created row if one exists) ──────
  IF v_balance > 0 THEN
    SELECT id INTO v_debtor FROM debtors WHERE transaction_id = v_txn LIMIT 1;

    IF v_debtor IS NOT NULL THEN
      UPDATE debtors SET
        company_id = p_company_id, customer_id = v_customer,
        customer_name = trim(p_customer_name), customer_phone = nullif(trim(p_customer_phone), ''),
        total_amount = v_total, amount_paid = v_paid, balance = v_balance, is_settled = false
      WHERE id = v_debtor;
      DELETE FROM debtors WHERE transaction_id = v_txn AND id <> v_debtor;
    ELSE
      INSERT INTO debtors (
        company_id, transaction_id, customer_id, customer_name, customer_phone,
        total_amount, amount_paid, balance, is_settled
      ) VALUES (
        p_company_id, v_txn, v_customer, trim(p_customer_name), nullif(trim(p_customer_phone), ''),
        v_total, v_paid, v_balance, false
      );
    END IF;
  END IF;

  RETURN json_build_object('transaction_id', v_txn, 'customer_id', v_customer, 'balance', v_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_sale(
  uuid, uuid, uuid, text, text, text, text, text,
  numeric, numeric, numeric, text, text, text, text
) TO authenticated;

-- Ask PostgREST to pick up the new function immediately
NOTIFY pgrst, 'reload schema';
