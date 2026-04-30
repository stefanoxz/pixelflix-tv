export type ErrorBucket =
  | "refused"
  | "reset"
  | "http_404"
  | "http_444"
  | "http_5xx"
  | "tls"
  | "cert_invalid"
  | "timeout"
  | "io_timeout"
  | "dns"
  | "no_route"
  | "net_unreach"
  | "protocol"
  | "other";

export interface Stats {
  totalEvents: number;
  events24h: number;
  success24h: number;
  fail24h: number;
  onlineNow: number;
  totalUsers: number;
  totalServers: number;
  allowedServers: number;
}

export interface AdminUser {
  username: string;
  last_server: string;
  last_login: string;
  last_success: boolean;
  total: number;
}

export interface AllowedServer {
  id: string;
  server_url: string;
  label: string | null;
  notes: string | null;
  created_at: string;
  last_seen: string | null;
  total_logins: number;
  success_count: number;
  fail_count: number;
  unique_users: number;
  stream_broken?: boolean;
}

export interface PendingServer {
  server_url: string;
  last_seen: string;
  total_logins: number;
  fail_count: number;
  unique_users: number;
}

export interface AdminEvent {
  id: string;
  username: string;
  server_url: string;
  success: boolean;
  reason: string | null;
  created_at: string;
}

export interface MonitoringSession {
  anon_user_id: string;
  iptv_username: string | null;
  ip_masked: string;
  server_url: string | null;
  started_at: string;
  last_seen_at: string;
  duration_s: number;
  content_kind: "live" | "movie" | "episode" | "idle" | null;
  content_title: string | null;
  content_id: string | null;
  content_started_at: string | null;
}

export interface MonitoringBlock {
  anon_user_id: string;
  blocked_until: string;
  reason: string | null;
  created_at: string;
}

export interface MonitoringErrorEvent {
  id: string;
  anon_user_id: string | null;
  event_type: string;
  ip_masked: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface MonitoringOverview {
  online_now: number;
  active_sessions: MonitoringSession[];
  active_blocks: MonitoringBlock[];
  recent_errors: MonitoringErrorEvent[];
  top_rejected_ips: { ip_masked: string; count: number }[];
}

export interface TopConsumer {
  anon_user_id: string;
  iptv_username: string;
  server_host: string;
  requests: number;
  segments: number;
}

export interface AdminBundle {
  stats: Stats;
  users: AdminUser[];
  servers: { allowed: AllowedServer[]; pending: PendingServer[] };
  events: AdminEvent[];
  monitoring: MonitoringOverview;
  top_consumers: TopConsumer[];
}

export interface DnsErrorServer {
  server_url: string;
  total: number;
  success: number;
  fail: number;
  last_seen: string | null;
  last_error: string | null;
  last_error_at: string | null;
  buckets: Record<ErrorBucket, number>;
}

export interface DnsErrorSeriesPoint {
  t: string;
  total: number;
  success: number;
  fail: number;
  refused: number; reset: number; http_404: number; http_444: number; http_5xx: number;
  tls: number; cert_invalid: number; timeout: number; io_timeout: number;
  dns: number; no_route: number; net_unreach: number; protocol: number; other: number;
}

export interface DnsErrorOverview {
  since: string;
  hours: number;
  step_ms?: number;
  totals: {
    total: number;
    success: number;
    fail: number;
    buckets: Record<ErrorBucket, number>;
  };
  servers: DnsErrorServer[];
  series?: DnsErrorSeriesPoint[];
  per_server_series?: { server_url: string; points: DnsErrorSeriesPoint[] }[];
}

export type HealthState = "online" | "unstable" | "offline";

export type HealthReason =
  | "online"
  | "auth_required"
  | "blocked"
  | "not_found"
  | "http_error"
  | "timeout"
  | "rst"
  | "network"
  | "stream_broken"
  | "unknown";

export interface HealthStatus {
  state: HealthState;
  online: boolean;
  latency: number | null;
  status: number | null;
  attempts?: number;
  checked_at: string;
  error?: string;
  reason?: HealthReason;
}
