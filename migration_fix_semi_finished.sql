-- 1. Fix Global Products Spec Types
UPDATE global_products
SET spec_type = 'base_add'
WHERE spec_type = 'sph_add'
AND (class_name ILIKE '%semi%' OR class_name ILIKE '%blank%');

UPDATE global_products
SET spec_type = 'base_only'
WHERE spec_type IN ('sph_cyl', 'sph_cyl_axis_add')
AND (class_name ILIKE '%semi%' OR class_name ILIKE '%blank%');

-- 2. Fix Existing Company Products
UPDATE products
SET spec_type = 'base_add'
FROM product_classes
WHERE products.class_id = product_classes.id
AND products.spec_type = 'sph_add'
AND (product_classes.name ILIKE '%semi%' OR product_classes.name ILIKE '%blank%');

UPDATE products
SET spec_type = 'base_only'
FROM product_classes
WHERE products.class_id = product_classes.id
AND products.spec_type IN ('sph_cyl', 'sph_cyl_axis_add')
AND (product_classes.name ILIKE '%semi%' OR product_classes.name ILIKE '%blank%');

-- 3. Fix Existing Stock formatting (+200 -> 200) for Semi-Finished
UPDATE stock
SET sph = REPLACE(sph, '+', '')
FROM products
JOIN product_classes ON products.class_id = product_classes.id
WHERE stock.product_id = products.id
AND (product_classes.name ILIKE '%semi%' OR product_classes.name ILIKE '%blank%')
AND stock.sph LIKE '+%';

-- 4. Fix Transaction logs formatting
UPDATE transactions
SET sph = REPLACE(sph, '+', '')
FROM products
JOIN product_classes ON products.class_id = product_classes.id
WHERE transactions.product_id = products.id
AND (product_classes.name ILIKE '%semi%' OR product_classes.name ILIKE '%blank%')
AND transactions.sph LIKE '+%';

-- 5. Fix Price configurations formatting
UPDATE product_prices
SET sph = REPLACE(sph, '+', '')
FROM products
JOIN product_classes ON products.class_id = product_classes.id
WHERE product_prices.product_id = products.id
AND (product_classes.name ILIKE '%semi%' OR product_classes.name ILIKE '%blank%')
AND product_prices.sph LIKE '+%';
