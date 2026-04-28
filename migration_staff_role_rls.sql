-- ============================================================
-- Migration: Fix staff role update (RLS + check constraint)
-- Run this in your Supabase SQL Editor (safe to re-run)
-- ============================================================

-- ── 1. Fix the CHECK constraint ───────────────────────────────
-- The existing constraint blocks 'manager' from being set.
-- Drop and recreate it to include all valid roles.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'company_admin', 'manager', 'staff', 'optician'));

-- ── 2. Fix the RLS UPDATE policy ─────────────────────────────
-- Drop the policy if it already exists so we can recreate cleanly
DROP POLICY IF EXISTS "company_admins_can_manage_staff" ON public.profiles;

-- Allow company admins (and managers) to UPDATE any profile
-- that belongs to the same company (enables role + location changes).
CREATE POLICY "company_admins_can_manage_staff"
ON public.profiles
FOR UPDATE
USING (
  -- The row being updated must belong to the same company as the caller
  company_id IN (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('company_admin', 'manager')
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('company_admin', 'manager')
  )
);
