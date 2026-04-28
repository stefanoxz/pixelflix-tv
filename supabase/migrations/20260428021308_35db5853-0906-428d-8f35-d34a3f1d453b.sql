-- =========================================================
-- 1. REVOKE EXECUTE em funções SECURITY DEFINER
-- =========================================================

-- Funções de manutenção: só service_role (edge functions internas)
REVOKE EXECUTE ON FUNCTION public.cleanup_client_diagnostics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_login_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_stream_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_used_nonces() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_admin_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_tmdb_image_cache() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_tmdb_episode_cache() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_blocked_dns_failures() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evict_idle_sessions() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cleanup_client_diagnostics() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_login_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_stream_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_used_nonces() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_admin_audit_log() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_tmdb_image_cache() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_tmdb_episode_cache() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_blocked_dns_failures() TO service_role;
GRANT EXECUTE ON FUNCTION public.evict_idle_sessions() TO service_role;

-- has_role: precisa continuar para authenticated (usado em RLS), mas bloquear anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- normalize_server_url: utilitário, sem dados sensíveis, mas restrito
REVOKE EXECUTE ON FUNCTION public.normalize_server_url(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_server_url(text) TO authenticated, service_role;

-- Trigger functions: só o sistema dispara
REVOKE EXECUTE ON FUNCTION public.update_blocked_dns_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_admin_signup() FROM PUBLIC, anon, authenticated;

-- =========================================================
-- 2. Recriar policies com TO authenticated
-- =========================================================

-- active_sessions
DROP POLICY IF EXISTS "Admins manage sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Admins read all sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Moderators delete sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Moderators read sessions" ON public.active_sessions;
DROP POLICY IF EXISTS "Users delete own session" ON public.active_sessions;
DROP POLICY IF EXISTS "Users read own session" ON public.active_sessions;

CREATE POLICY "Admins manage sessions" ON public.active_sessions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read all sessions" ON public.active_sessions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators delete sessions" ON public.active_sessions
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Moderators read sessions" ON public.active_sessions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Users delete own session" ON public.active_sessions
  FOR DELETE TO authenticated
  USING (anon_user_id = auth.uid());
CREATE POLICY "Users read own session" ON public.active_sessions
  FOR SELECT TO authenticated
  USING (anon_user_id = auth.uid());

-- admin_audit_log
DROP POLICY IF EXISTS "Admins read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins read audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- allowed_servers
DROP POLICY IF EXISTS "Admins manage allowed_servers" ON public.allowed_servers;
DROP POLICY IF EXISTS "Moderators read allowed_servers" ON public.allowed_servers;
CREATE POLICY "Admins manage allowed_servers" ON public.allowed_servers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators read allowed_servers" ON public.allowed_servers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- blocked_dns_failures
DROP POLICY IF EXISTS "Admins read blocked_dns_failures" ON public.blocked_dns_failures;
CREATE POLICY "Admins read blocked_dns_failures" ON public.blocked_dns_failures
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- blocked_dns_servers
DROP POLICY IF EXISTS "Admins manage blocked_dns_servers" ON public.blocked_dns_servers;
DROP POLICY IF EXISTS "Moderators read blocked_dns_servers" ON public.blocked_dns_servers;
CREATE POLICY "Admins manage blocked_dns_servers" ON public.blocked_dns_servers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators read blocked_dns_servers" ON public.blocked_dns_servers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- client_diagnostics
DROP POLICY IF EXISTS "Admins read diagnostics" ON public.client_diagnostics;
DROP POLICY IF EXISTS "Moderators read diagnostics" ON public.client_diagnostics;
CREATE POLICY "Admins read diagnostics" ON public.client_diagnostics
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators read diagnostics" ON public.client_diagnostics
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- login_events
DROP POLICY IF EXISTS "Admins read login_events" ON public.login_events;
DROP POLICY IF EXISTS "Moderators read login_events" ON public.login_events;
CREATE POLICY "Admins read login_events" ON public.login_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators read login_events" ON public.login_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- pending_admin_signups
DROP POLICY IF EXISTS "Admins read pending signups" ON public.pending_admin_signups;
DROP POLICY IF EXISTS "Moderators read pending signups" ON public.pending_admin_signups;
DROP POLICY IF EXISTS "Users read own pending" ON public.pending_admin_signups;
CREATE POLICY "Admins read pending signups" ON public.pending_admin_signups
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators read pending signups" ON public.pending_admin_signups
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Users read own pending" ON public.pending_admin_signups
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- stream_events
DROP POLICY IF EXISTS "Admins read all events" ON public.stream_events;
DROP POLICY IF EXISTS "Moderators read stream_events" ON public.stream_events;
DROP POLICY IF EXISTS "Users read own events" ON public.stream_events;
CREATE POLICY "Admins read all events" ON public.stream_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators read stream_events" ON public.stream_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Users read own events" ON public.stream_events
  FOR SELECT TO authenticated
  USING (anon_user_id = auth.uid());

-- usage_counters
DROP POLICY IF EXISTS "Admins read all usage" ON public.usage_counters;
DROP POLICY IF EXISTS "Moderators read usage" ON public.usage_counters;
DROP POLICY IF EXISTS "Users read own usage" ON public.usage_counters;
CREATE POLICY "Admins read all usage" ON public.usage_counters
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators read usage" ON public.usage_counters
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Users read own usage" ON public.usage_counters
  FOR SELECT TO authenticated
  USING (anon_user_id = auth.uid());

-- user_blocks
DROP POLICY IF EXISTS "Admins manage blocks" ON public.user_blocks;
DROP POLICY IF EXISTS "Moderators create blocks" ON public.user_blocks;
DROP POLICY IF EXISTS "Moderators read blocks" ON public.user_blocks;
DROP POLICY IF EXISTS "Users read own block" ON public.user_blocks;
CREATE POLICY "Admins manage blocks" ON public.user_blocks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators create blocks" ON public.user_blocks
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Moderators read blocks" ON public.user_blocks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Users read own block" ON public.user_blocks
  FOR SELECT TO authenticated
  USING (anon_user_id = auth.uid());

-- user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Moderators read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- watch_progress
DROP POLICY IF EXISTS "Admins manage watch_progress" ON public.watch_progress;
DROP POLICY IF EXISTS "Admins read all watch_progress" ON public.watch_progress;
DROP POLICY IF EXISTS "Moderators read watch_progress" ON public.watch_progress;
CREATE POLICY "Admins manage watch_progress" ON public.watch_progress
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read all watch_progress" ON public.watch_progress
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Moderators read watch_progress" ON public.watch_progress
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));