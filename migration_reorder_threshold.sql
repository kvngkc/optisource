-- Low-stock reorder threshold migration
-- Run this once in your Supabase SQL Editor

ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_threshold integer DEFAULT NULL;
