-- 1. Enable RLS on the profiles table (Fixes "Policy Exists RLS Disabled" & "RLS Disabled in Public")
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Secure the view by enforcing the invoker's permissions rather than the definer's (Fixes "Security Definer View")
ALTER VIEW public.public_stock_summary SET (security_invoker = true);

-- 3. Set search_path on functions to prevent search path injection attacks (Fixes "Function Search Path Mutable" warnings)
ALTER FUNCTION public.create_company_and_admin SET search_path = public;
ALTER FUNCTION public.current_company_id SET search_path = public;
ALTER FUNCTION public.current_user_role SET search_path = public;

