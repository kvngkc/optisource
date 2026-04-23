-- ============================================================
--  Optisource: Normalize Addition values for base_add products
--  Strip the '+' sign from addition column so that '+300' and
--  '300' both become '300', then merge any duplicate stock rows.
-- ============================================================

-- ── STEP 0: Preview what will change ─────────────────────────
SELECT s.id, p.name as product, s.sph, s.addition, s.qty
FROM stock s
JOIN products p ON s.product_id = p.id
WHERE p.spec_type = 'base_add'
  AND s.addition LIKE '+%';

-- ── STEP 1: Merge duplicate stock rows that arise from +300 vs 300 ───
-- (safe to run even if no duplicates exist)
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN (
    SELECT
      s.product_id, s.location_id, s.company_id, s.sph,
      REPLACE(s.addition, '+', '') AS norm_add,
      MIN(s.id) AS keep_id,
      SUM(s.qty) AS total_qty,
      COALESCE(SUM(s.allocated_qty), 0) AS total_alloc
    FROM stock s
    JOIN products p ON s.product_id = p.id
    WHERE p.spec_type = 'base_add'
      AND s.addition LIKE '+%'
    GROUP BY s.product_id, s.location_id, s.company_id, s.sph, REPLACE(s.addition, '+', '')
    HAVING COUNT(*) > 1
  )
  LOOP
    -- Update the kept row: normalize addition and sum quantities
    UPDATE stock
    SET addition = dup.norm_add,
        qty = dup.total_qty,
        allocated_qty = dup.total_alloc,
        updated_at = now()
    WHERE id = dup.keep_id;

    -- Delete the duplicate rows (leaving only keep_id)
    DELETE FROM stock
    WHERE product_id  = dup.product_id
      AND location_id = dup.location_id
      AND company_id  = dup.company_id
      AND sph         = dup.sph
      AND REPLACE(addition, '+', '') = dup.norm_add
      AND id != dup.keep_id;
  END LOOP;
END $$;

-- ── STEP 2: Normalize any remaining base_add stock addition values ────
UPDATE stock
SET addition = REPLACE(addition, '+', ''),
    updated_at = now()
FROM products
WHERE stock.product_id = products.id
  AND products.spec_type = 'base_add'
  AND stock.addition LIKE '+%';

-- ── STEP 3: Normalize transactions (for correct void lookups) ─────────
UPDATE transactions
SET addition = REPLACE(addition, '+', '')
FROM products
WHERE transactions.product_id = products.id
  AND products.spec_type = 'base_add'
  AND transactions.addition LIKE '+%';

-- ── STEP 4: Normalize product_prices (for correct price lookups) ──────
UPDATE product_prices
SET addition = REPLACE(addition, '+', '')
FROM products
WHERE product_prices.product_id = products.id
  AND products.spec_type = 'base_add'
  AND product_prices.addition LIKE '+%';

-- ── STEP 5: Normalize product_price_ranges if applicable ──────────────
UPDATE product_price_ranges
SET addition = REPLACE(addition, '+', '')
FROM products
WHERE product_price_ranges.product_id = products.id
  AND products.spec_type = 'base_add'
  AND product_price_ranges.addition LIKE '+%';

-- ── STEP 6: Verify — should return 0 rows ─────────────────────────────
SELECT s.id, p.name, s.addition
FROM stock s
JOIN products p ON s.product_id = p.id
WHERE p.spec_type = 'base_add'
  AND s.addition LIKE '+%';
-- Expected: 0 rows
