-- ============================================================
-- Migration: Find and disable the auto-debtor trigger
-- Run STEP 1 first to see what triggers exist, then run STEP 2
-- ============================================================

-- STEP 1: Inspect triggers on the transactions table
-- Run this first and note the trigger_name(s) shown
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table   = 'transactions';

-- ============================================================
-- STEP 2: Drop the auto-debtor trigger
-- Replace <trigger_name> with the name from Step 1 that
-- auto-inserts into the debtors table.
-- Example:
--   DROP TRIGGER IF EXISTS create_debtor_on_sale ON public.transactions;
-- ============================================================
-- DROP TRIGGER IF EXISTS <trigger_name> ON public.transactions;
