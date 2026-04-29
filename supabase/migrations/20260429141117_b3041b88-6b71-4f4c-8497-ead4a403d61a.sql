-- Revoke EXECUTE on internal SECURITY DEFINER functions from public roles.
-- These should only be invoked by cron jobs / service role, never by clients.

REVOKE EXECUTE ON FUNCTION public.cleanup_client_diagnostics() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_login_events() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_stream_events() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.evict_idle_sessions() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_used_nonces() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_admin_audit_log() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_tmdb_image_cache() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_tmdb_episode_cache() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_blocked_dns_failures() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_admin_signup() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_blocked_dns_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.normalize_server_url(text) FROM anon, authenticated, public;

-- has_role MUST remain executable by authenticated (the frontend uses it via RPC).
-- It already has internal caller checks that prevent probing other users' roles.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;