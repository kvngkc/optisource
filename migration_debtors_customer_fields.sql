-- ============================================================
-- Migration: Add customer_name and customer_phone to debtors
-- Run this in your Supabase SQL Editor (safe to re-run)
-- ============================================================

-- Add customer_name if it doesn't exist
ALTER TABLE public.debtors
  ADD COLUMN IF NOT EXISTS customer_name  text;

-- Add customer_phone if it doesn't exist
ALTER TABLE public.debtors
  ADD COLUMN IF NOT EXISTS customer_phone text;
