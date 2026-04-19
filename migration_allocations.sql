ALTER TABLE stock ADD COLUMN allocated_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE optician_order_items ADD COLUMN allocations JSONB DEFAULT '[]'::jsonb;
