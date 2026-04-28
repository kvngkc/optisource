-- ============================================================
-- Migration: Allow company_admin to update staff roles
-- Run this in your Supabase SQL Editor
-- ============================================================

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
