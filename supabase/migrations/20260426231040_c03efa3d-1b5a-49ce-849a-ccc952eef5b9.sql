-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_email text,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON public.admin_audit_log (actor_user_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins read audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Cleanup
CREATE OR REPLACE FUNCTION public.cleanup_admin_audit_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE removed integer;
BEGIN
  WITH del AS (
    DELETE FROM public.admin_audit_log
    WHERE created_at < now() - interval '180 days'
    RETURNING 1
  ) SELECT count(*) INTO removed FROM del;
  RETURN removed;
END $$;

-- Políticas para moderadores
DROP POLICY IF EXISTS "Moderators read sessions" ON public.active_sessions;
CREATE POLICY "Moderators read sessions"
  ON public.active_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators delete sessions" ON public.active_sessions;
CREATE POLICY "Moderators delete sessions"
  ON public.active_sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators read blocks" ON public.user_blocks;
CREATE POLICY "Moderators read blocks"
  ON public.user_blocks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators create blocks" ON public.user_blocks;
CREATE POLICY "Moderators create blocks"
  ON public.user_blocks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators read stream_events" ON public.stream_events;
CREATE POLICY "Moderators read stream_events"
  ON public.stream_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators read usage" ON public.usage_counters;
CREATE POLICY "Moderators read usage"
  ON public.usage_counters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators read diagnostics" ON public.client_diagnostics;
CREATE POLICY "Moderators read diagnostics"
  ON public.client_diagnostics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators read login_events" ON public.login_events;
CREATE POLICY "Moderators read login_events"
  ON public.login_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators read pending signups" ON public.pending_admin_signups;
CREATE POLICY "Moderators read pending signups"
  ON public.pending_admin_signups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators read allowed_servers" ON public.allowed_servers;
CREATE POLICY "Moderators read allowed_servers"
  ON public.allowed_servers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators read watch_progress" ON public.watch_progress;
CREATE POLICY "Moderators read watch_progress"
  ON public.watch_progress FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Moderators read all roles" ON public.user_roles;
CREATE POLICY "Moderators read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'));