-- =====================================================
-- Fix Function Search Path Security Warnings (Safe Method)
-- =====================================================
-- Instead of dropping functions, we'll recreate them with CREATE OR REPLACE
-- and add the secure search_path setting

-- Function to get current user's team ID
CREATE OR REPLACE FUNCTION public.get_user_team_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT team_id 
    FROM team_members 
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Function to check if user is team admin/owner
CREATE OR REPLACE FUNCTION public.is_team_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Function to check if user teaches a specific class
CREATE OR REPLACE FUNCTION public.user_teaches_class(class_id_param INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM class_teachers 
    WHERE teacher_id = auth.uid() 
    AND class_id = class_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Function to get user's taught class IDs
CREATE OR REPLACE FUNCTION public.get_user_class_ids()
RETURNS INTEGER[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT class_id 
    FROM class_teachers 
    WHERE teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Fix the get_user_id_by_email function - drop first to handle return type changes
DROP FUNCTION IF EXISTS public.get_user_id_by_email(text);

-- Recreate with correct parameter name (user_email) and return type
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email text)
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT id 
    FROM profiles 
    WHERE email = user_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Verify functions were updated with correct settings
SELECT 
  routine_name,
  routine_type,
  security_type,
  sql_data_access,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'get_user_team_id', 'is_team_admin', 'user_teaches_class', 
  'get_user_class_ids', 'get_user_id_by_email'
);

-- Check that the functions now have proper search_path settings
-- This query will show the function definitions including the SET search_path
SELECT 
  proname AS function_name,
  proconfig AS function_config
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND proname IN ('get_user_team_id', 'is_team_admin', 'user_teaches_class', 'get_user_class_ids', 'get_user_id_by_email'); 