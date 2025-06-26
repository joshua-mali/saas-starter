-- =====================================================
-- Fix Function Search Path Security Warnings
-- =====================================================
-- These functions need to be recreated with proper search_path settings
-- to prevent SQL injection attacks

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_user_team_id();
DROP FUNCTION IF EXISTS public.is_team_admin();
DROP FUNCTION IF EXISTS public.user_teaches_class(INTEGER);
DROP FUNCTION IF EXISTS public.get_user_class_ids();

-- Recreate functions with secure search_path
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

-- Fix the get_user_id_by_email function if it exists
-- (This might be from your application code)
DROP FUNCTION IF EXISTS public.get_user_id_by_email(text);

-- If you need this function, recreate it securely:
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email_param text)
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT id 
    FROM profiles 
    WHERE email = email_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Verify functions were created with correct settings
SELECT 
  routine_name,
  routine_type,
  security_type,
  sql_data_access
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'get_user_team_id', 'is_team_admin', 'user_teaches_class', 
  'get_user_class_ids', 'get_user_id_by_email'
); 