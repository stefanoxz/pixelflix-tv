import type { HealthState, HealthReason } from "@/types/admin";

export function failPctClass(pct: number): string {
  if (pct >= 80) return "text-destructive";
  if (pct >= 30) return "text-warning";
  return "text-success";
}


export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function latencyClass(ms: number | null): string {
  if (ms == null) return "text-muted-foreground";
  if (ms < 200) return "text-success";
  if (ms < 500) return "text-warning";
  return "text-destructive";
}

export function statusClass(status: number | null): string {
  if (status == null) return "text-muted-foreground bg-muted/40";
  if (status >= 200 && status < 300) return "text-success bg-success/10";
  if (status === 401) return "text-success bg-success/10";
  if (status === 403 || (status >= 500 && status < 600)) return "text-warning bg-warning/10";
  return "text-warning bg-warning/10";
}

export function stateBadge(state: HealthState): { dot: string; label: string; cls: string } {
  switch (state) {
    case "online":
      return { dot: "🟢", label: "Online", cls: "text-success" };
    case "unstable":
      return { dot: "🟡", label: "Instável", cls: "text-warning" };
    case "offline":
      return { dot: "🔴", label: "Offline", cls: "text-destructive" };
  }
}

export function stateTooltip(state: HealthState): string {
  switch (state) {
    case "online":
      return "Servidor respondeu OK (HTTP 2xx ou 401). Disponível para login.";
    case "unstable":
      return "Respondeu com aviso (HTTP 403, 5xx ou 1 timeout). Pode estar sob Cloudflare ou sobrecarregado.";
    case "offline":
      return "Sem resposta (erro de rede ou 2 timeouts seguidos). Login bloqueado.";
  }
}

export function httpTooltip(status: number): string {
  if (status >= 200 && status < 300) return `HTTP ${status} OK — servidor respondeu normalmente.`;
  if (status === 401) return "401 — autenticação requerida. Servidor está vivo (considerado online).";
  if (status === 403) return "403 — bloqueado (geralmente Cloudflare). Servidor pode estar OK para o cliente.";
  if (status === 404) return "404 — endpoint não encontrado nesse servidor.";
  if (status >= 500 && status < 600) return `${status} — erro interno do servidor (sobrecarga ou falha).`;
  return `HTTP ${status} — resposta inesperada do servidor.`;
}

export function reasonInfo(reason: HealthReason | undefined): { label: string; tooltip: string; cls: string } | null {
  switch (reason) {
    case "online":
      return { label: "Online", tooltip: "Servidor respondeu normalmente (HTTP 2xx).", cls: "text-success" };
    case "auth_required":
      return { label: "Online (auth)", tooltip: "Servidor vivo, exige autenticação (HTTP 401). Considerado disponível.", cls: "text-success" };
    case "blocked":
      return { label: "Bloqueado", tooltip: "Servidor bloqueou a requisição (HTTP 403 — Cloudflare/WAF).", cls: "text-warning" };
    case "http_error":
      return { label: "Erro no servidor", tooltip: "Servidor respondeu com erro 5xx (sobrecarga ou falha interna).", cls: "text-warning" };
    case "not_found":
      return { label: "Endpoint ausente", tooltip: "HTTP 404 — /player_api.php não encontrado nessa DNS.", cls: "text-warning" };
    case "timeout":
      return { label: "Lento / timeout", tooltip: "Sem resposta em 5s. Servidor lento ou sobrecarregado.", cls: "text-warning" };
    case "rst":
      return { label: "Conexão recusada", tooltip: "Servidor derrubou a conexão (RST). Aplicação parada ou domínio migrado.", cls: "text-destructive" };
    case "network":
      return { label: "Sem conexão", tooltip: "Erro de rede (DNS, TLS ou recusa). Servidor inacessível.", cls: "text-destructive" };
    case "stream_broken":
      return { label: "Sem stream", tooltip: "Servidor responde ao ping, mas usuários reportaram falha ao reproduzir vídeo (≥3 reports em 5min).", cls: "text-destructive" };
    case "unknown":
    default:
      return null;
  }
}
