-- Optician approval gate migration
-- Run this once in your Supabase SQL Editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false;

-- Approve all existing non-optician users immediately
UPDATE profiles SET is_approved = true WHERE role != 'optician';

-- Approve existing opticians who were already using the system
-- (remove this line if you want ALL opticians to re-request approval)
UPDATE profiles SET is_approved = true WHERE role = 'optician';
