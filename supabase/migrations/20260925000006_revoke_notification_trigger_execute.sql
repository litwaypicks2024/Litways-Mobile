-- Trigger functions are run by the trigger mechanism, not called by clients. Without this, the
-- SECURITY DEFINER notify_order_status() was callable through the public REST API (Supabase
-- security advisor: anon/authenticated_security_definer_function_executable).
revoke execute on function public.notify_order_status() from public, anon, authenticated;
revoke execute on function public.trim_user_notifications() from public, anon, authenticated;
