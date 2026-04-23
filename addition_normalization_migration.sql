-- ============================================================
--  Optisource: Normalize Addition values for base_add products
--  v3 — UUID-safe, no created_at dependency
-- ============================================================

-- ── STEP 0: Preview what will change ─────────────────────────
SELECT s.id, p.name AS product, s.sph, s.addition, s.qty
FROM stock s
JOIN products p ON s.product_id = p.id
WHERE p.spec_type = 'base_add'
  AND s.addition LIKE '+%';

-- ── STEP 1: Merge duplicate rows (UUID-safe, no created_at) ──────────
-- Update the "keeper" row with the total qty across all duplicates

WITH ranked AS (
  SELECT
    s.id,
    REPLACE(s.addition, '+', '')                                      AS norm_add,
    ROW_NUMBER() OVER (
      PARTITION BY s.product_id, s.location_id, s.company_id, s.sph, REPLACE(s.addition, '+', '')
      ORDER BY s.id::text                  -- stable sort on UUID text
    )                                                                  AS rn,
    SUM(s.qty) OVER (
      PARTITION BY s.product_id, s.location_id, s.company_id, s.sph, REPLACE(s.addition, '+', '')
    )                                                                  AS total_qty,
    COALESCE(SUM(s.allocated_qty) OVER (
      PARTITION BY s.product_id, s.location_id, s.company_id, s.sph, REPLACE(s.addition, '+', '')
    ), 0)                                                              AS total_alloc
  FROM stock s
  JOIN products p ON s.product_id = p.id
  WHERE p.spec_type = 'base_add'
    AND s.addition LIKE '+%'
)
UPDATE stock
SET addition      = ranked.norm_add,
    qty           = ranked.total_qty,
    allocated_qty = ranked.total_alloc,
    updated_at    = now()
FROM ranked
WHERE stock.id = ranked.id
  AND ranked.rn = 1;

-- Delete the duplicate rows (all but the keeper)
WITH ranked AS (
  SELECT
    s.id,
    ROW_NUMBER() OVER (
      PARTITION BY s.product_id, s.location_id, s.company_id, s.sph, REPLACE(s.addition, '+', '')
      ORDER BY s.id::text
    ) AS rn
  FROM stock s
  JOIN products p ON s.product_id = p.id
  WHERE p.spec_type = 'base_add'
    AND s.addition LIKE '+%'
)
DELETE FROM stock
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ── STEP 2: Normalize any remaining base_add stock addition values ────
UPDATE stock
SET addition   = REPLACE(addition, '+', ''),
    updated_at = now()
FROM products
WHERE stock.product_id = products.id
  AND products.spec_type = 'base_add'
  AND stock.addition LIKE '+%';

-- ── STEP 3: Normalize transactions ────────────────────────────────────
UPDATE transactions
SET addition = REPLACE(addition, '+', '')
FROM products
WHERE transactions.product_id = products.id
  AND products.spec_type = 'base_add'
  AND transactions.addition LIKE '+%';

-- ── STEP 4: Normalize product_prices ──────────────────────────────────
UPDATE product_prices
SET addition = REPLACE(addition, '+', '')
FROM products
WHERE product_prices.product_id = products.id
  AND products.spec_type = 'base_add'
  AND product_prices.addition LIKE '+%';

-- ── STEP 5: Normalize product_price_ranges (uses add_min / add_max) ──
UPDATE product_price_ranges
SET add_min = REPLACE(add_min, '+', ''),
    add_max = REPLACE(add_max, '+', '')
FROM products
WHERE product_price_ranges.product_id = products.id
  AND products.spec_type = 'base_add'
  AND (product_price_ranges.add_min LIKE '+%' OR product_price_ranges.add_max LIKE '+%');

-- ── STEP 6: Verify — should return 0 rows ─────────────────────────────
SELECT s.id, p.name, s.addition
FROM stock s
JOIN products p ON s.product_id = p.id
WHERE p.spec_type = 'base_add'
  AND s.addition LIKE '+%';
-- Expected: (0 rows)
