import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Wifi, Copy, Download, Globe, Mail, AlertTriangle, Lightbulb, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BlockedDnsDialog } from "./BlockedDnsDialog";

type ClientReachState = "reachable" | "unreachable" | "blocked_mixed" | "error";

interface ClientProbeAttempt {
  variant: string;
  state: ClientReachState;
  latency_ms: number;
  method: "fetch" | "image" | "skipped";
  detail: string;
}

interface ClientProbeResult {
  attempts: ClientProbeAttempt[];
  any_reachable: boolean;
  page_is_https: boolean;
  ran_at: string;
}

/** Classifica latência de uma falha pra distinguir rejeição local vs servidor */
function classifyFailureLatency(latencyMs: number): string {
  if (latencyMs < 25) return "rejeição local (não saiu do dispositivo)";
  if (latencyMs < 80) return "rejeitado na rede local/ISP";
  return "servidor recebeu e cortou";
}

/**
 * Probe via <img>: tenta carregar /favicon.ico como imagem.
 * - onload => servidor respondeu com bytes (mesmo que não seja imagem válida, em alguns casos)
 * - onerror => pode ser CORS/mime ou TCP recusado — não é conclusivo de "online", mas
 *   se a latência for alta (>100ms) é forte indício que o pacote chegou ao servidor.
 * Funciona em página HTTPS para alvos HTTP em vários navegadores (não bloqueado por mixed content como fetch).
 */
function imageProbe(url: string, timeoutMs = 5000): Promise<{ ok: boolean; latency: number }> {
  return new Promise((resolve) => {
    const start = performance.now();
    const img = new Image();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      img.onload = null;
      img.onerror = null;
      resolve({ ok, latency: Math.round(performance.now() - start) });
    };
    const t = setTimeout(() => finish(false), timeoutMs);
    img.onload = () => { clearTimeout(t); finish(true); };
    img.onerror = () => { clearTimeout(t); finish(false); };
    // bust cache + força GET de imagem
    img.src = url.replace(/\/+$/, "") + "/favicon.ico?_=" + Date.now();
  });
}

async function clientProbeOne(variant: string, pageIsHttps: boolean, timeoutMs = 6000): Promise<ClientProbeAttempt> {
  const variantIsHttp = /^http:\/\//i.test(variant);
  const mixedBlocked = pageIsHttps && variantIsHttp;

  // Caminho 1: fetch no-cors (só funciona quando NÃO há mixed content)
  if (!mixedBlocked) {
    const url = variant.replace(/\/+$/, "") + "/player_api.php?username=probe&password=probe";
    const start = performance.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store", signal: ctrl.signal, redirect: "follow" });
      clearTimeout(t);
      const latency = Math.round(performance.now() - start);
      return {
        variant, state: "reachable", latency_ms: latency, method: "fetch",
        detail: "Servidor respondeu (opaque) — TCP/HTTP acessível do seu IP",
      };
    } catch (err) {
      clearTimeout(t);
      const latency = Math.round(performance.now() - start);
      const msg = err instanceof Error ? err.message : String(err);
      if (/abort/i.test(msg) || ctrl.signal.aborted) {
        return { variant, state: "unreachable", latency_ms: latency, method: "fetch", detail: "Timeout do navegador" };
      }
      return {
        variant, state: "unreachable", latency_ms: latency, method: "fetch",
        detail: `Falha de rede — ${classifyFailureLatency(latency)}`,
      };
    }
  }

  // Caminho 2: fallback via <img> quando há mixed content
  const r = await imageProbe(variant, timeoutMs);
  if (r.ok) {
    return {
      variant, state: "reachable", latency_ms: r.latency, method: "image",
      detail: "Favicon carregou — servidor está vivo (probe via <img>)",
    };
  }
  // Sem onload, mas latência alta => pacote chegou ao servidor (forte indício)
  if (r.latency > 100) {
    return {
      variant, state: "reachable", latency_ms: r.latency, method: "image",
      detail: `Sem favicon, mas ${r.latency}ms indica que o pacote chegou ao servidor`,
    };
  }
  // Latência baixa em página HTTPS → mixed content bloqueou tudo localmente
  return {
    variant, state: "blocked_mixed", latency_ms: r.latency, method: "image",
    detail: "Bloqueado pelo navegador (Mixed Content HTTPS→HTTP) — não é falha do servidor",
  };
}

async function runClientProbe(serverUrl: string): Promise<ClientProbeResult> {
  const base = serverUrl.replace(/\/+$/, "");
  const noProto = base.replace(/^https?:\/\//i, "");
  const host = noProto.split("/")[0].split(":")[0];
  const variants = Array.from(new Set([
    base,
    `http://${host}`,
    `https://${host}`,
    `http://${host}:8080`,
  ]));
  const pageIsHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const attempts = await Promise.all(variants.map((v) => clientProbeOne(v, pageIsHttps)));
  return {
    attempts,
    any_reachable: attempts.some((a) => a.state === "reachable"),
    page_is_https: pageIsHttps,
    ran_at: new Date().toISOString(),
  };
}

interface ProbeResult {
  variant: string;
  ok: boolean;
  status: number | null;
  latency_ms: number;
  is_xtream: boolean;
  auth: number | string | null;
  body_preview: string;
  headers?: Record<string, string>;
  error: string | null;
}

interface ProbeResponse {
  server_url: string;
  normalized: string;
  tested_variants: number;
  timeout_ms: number;
  best_variant: string | null;
  best_status: number | null;
  results: ProbeResult[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverUrl: string | null;
  serverLabel?: string | null;
}

function classifyError(err: string | null): string {
  if (!err) return "—";
  const r = err.toLowerCase();
  if (/connection refused|os error 111/.test(r)) return "Porta fechada (Connection refused)";
  if (/reset by peer|os error 104/.test(r)) return "Conexão cortada pelo servidor (Reset by peer)";
  if (/timeout|timed out|deadline/.test(r)) return "Tempo esgotado (Timeout)";
  if (/no route to host|os error 113/.test(r)) return "Sem rota até o host";
  if (/network is unreachable/.test(r)) return "Rede inacessível";
  if (/getaddrinfo|name resolution|nxdomain/.test(r)) return "Hostname não resolveu (DNS)";
  if (/unrecognisedname|certificate|tls|ssl|handshake/.test(r)) return "Erro de certificado/TLS";
  if (/protocol|invalid http|wrong version/.test(r)) return "Erro de protocolo HTTP";
  return err.length > 90 ? `${err.slice(0, 90)}…` : err;
}

function statusBadge(r: ProbeResult) {
  if (r.is_xtream) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-success/15 text-success border border-success/30">
        <CheckCircle2 className="h-3 w-3" /> Xtream OK
      </span>
    );
  }
  if (r.status === 401) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-warning/15 text-warning border border-warning/30">
        <CheckCircle2 className="h-3 w-3" /> Vivo (401)
      </span>
    );
  }
  if (r.status && r.status >= 200 && r.status < 400) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-success/15 text-success border border-success/30">
        <CheckCircle2 className="h-3 w-3" /> HTTP {r.status}
      </span>
    );
  }
  if (r.status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-warning/15 text-warning border border-warning/30">
        HTTP {r.status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-destructive/15 text-destructive border border-destructive/30">
      <XCircle className="h-3 w-3" /> Falhou
    </span>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function fmtTimestamp(d: Date) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function h(r: ProbeResult, key: string): string {
  if (!r.headers) return "";
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(r.headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return "";
}

type BlockKind =
  | "suspended"
  | "expired_account"
  | "waf_challenge"
  | "waf_block"
  | "ddos_protection"
  | "rate_limit"
  | "geoblock"
  | "ip_block_403"
  | "ip_block_404_nginx"
  | "ip_block_reset"
  | "default_landing"
  | "redirect_loop"
  | "wrong_protocol"
  | "auth_required"
  | "xtream_ok"
  | "xtream_invalid_creds"
  | "server_error"
  | "timeout"
  | "refused"
  | "tls_error"
  | "dns_error"
  | "unknown_2xx"
  | null;

function detectBlockKind(r: ProbeResult): BlockKind {
  const body = (r.body_preview || "").toLowerCase();
  const err = (r.error || "").toLowerCase();
  const server = h(r, "server").toLowerCase();
  const cfMitigated = h(r, "cf-mitigated").toLowerCase();
  const cfRay = h(r, "cf-ray");
  const sucuri = h(r, "x-sucuri-id");
  const retryAfter = h(r, "retry-after");
  const rateRemaining = h(r, "x-ratelimit-remaining");
  const location = h(r, "location");

  // 1) Sucesso explícito
  if (r.is_xtream && (r.auth === 1 || r.auth === "1")) return "xtream_ok";
  if (r.is_xtream && (r.auth === 0 || r.auth === "0")) return "xtream_invalid_creds";

  // 2) Conta IPTV expirada (string típica do Xtream)
  if (/expired|trial.*ended|account.*disabled/.test(body) && !/suspend/.test(body)) {
    return "expired_account";
  }

  // 3) Conta de hospedagem suspensa
  if (/account (has been )?suspended|account suspended|site suspended|account disabled by/.test(body)) {
    return "suspended";
  }

  // 4) Página default de servidor (DNS aponta pra IP errado/sem vhost)
  if (/welcome to nginx|apache2 (ubuntu|debian|centos) default|it works!|test page for the apache/.test(body)) {
    return "default_landing";
  }

  // 5) Rate limit
  if (r.status === 429 || retryAfter || rateRemaining === "0") return "rate_limit";

  // 6) DDoS protection challenge (Cloudflare JS challenge, DDoS-Guard, StackPath)
  if (
    /just a moment|checking your browser|attention required|please enable javascript and cookies|ddos.guard|ddos-guard|stackpath/.test(body) ||
    cfMitigated === "challenge"
  ) {
    return "ddos_protection";
  }

  // 7) WAF block (Cloudflare 403 + cf-mitigated, Sucuri, Imunify, ModSecurity)
  if (
    cfMitigated === "block" ||
    (sucuri && r.status === 403) ||
    /access denied.*sucuri|imunify|mod_security|modsecurity|blocked by.*firewall/.test(body)
  ) {
    return "waf_block";
  }

  // 8) Geoblock
  if (
    /not available in your (country|region|location)|geo.?(block|restricted)|country.*blocked|region.*restricted|access denied.*country/.test(body)
  ) {
    return "geoblock";
  }

  // 9) Redirect loop / location estranho
  if (r.status && r.status >= 300 && r.status < 400 && location) {
    if (/login|portal|index\.html?/.test(location.toLowerCase())) return "redirect_loop";
  }

  // 10) Códigos HTTP clássicos de bloqueio
  if (r.status === 403) return "ip_block_403";
  if (r.status === 401) return "auth_required";
  if (r.status === 404) {
    // 404 com nginx default = IP block disfarçado
    if (server.includes("nginx") || server.includes("cloudflare") || cfRay) return "ip_block_404_nginx";
    return "ip_block_404_nginx";
  }
  if (r.status === 444) return "suspended";
  if (r.status && r.status >= 500 && r.status < 600) return "server_error";

  // 11) HTTPS no painel só HTTP (ou vice-versa)
  if (/wrong version|protocol|invalid http|http_request_sent_to_https_port/.test(err)) return "wrong_protocol";

  // 12) Erros de transporte
  if (/reset by peer|os error 104/.test(err)) return "ip_block_reset";
  if (/timeout|timed out|deadline/.test(err)) return "timeout";
  if (/refused|os error 111/.test(err)) return "refused";
  if (/certificate|tls|ssl|handshake|unrecognisedname/.test(err)) return "tls_error";
  if (/getaddrinfo|name resolution|nxdomain/.test(err)) return "dns_error";

  // 13) 2xx sem ser Xtream
  if (r.status && r.status >= 200 && r.status < 300) return "unknown_2xx";

  return null;
}

const KIND_LABEL: Record<NonNullable<BlockKind>, string> = {
  xtream_ok: "Xtream OK (credenciais válidas)",
  xtream_invalid_creds: "Xtream respondeu mas auth=0 (credenciais inválidas)",
  suspended: "Conta da hospedagem SUSPENSA na origem",
  expired_account: "Conta IPTV expirada / desabilitada",
  waf_challenge: "WAF exigindo desafio (Cloudflare Challenge)",
  waf_block: "WAF/Firewall bloqueando explicitamente",
  ddos_protection: "Proteção anti-DDoS exigindo navegador real (JS challenge)",
  rate_limit: "Rate limit atingido (HTTP 429 / Retry-After)",
  geoblock: "Bloqueio geográfico (país/região não permitido)",
  ip_block_403: "IP bloqueado (HTTP 403 Forbidden)",
  ip_block_404_nginx: "IP bloqueado disfarçado de 404 (nginx/cloudflare)",
  ip_block_reset: "Conexão cortada — filtro anti-datacenter (Reset by peer)",
  default_landing: "Página default do servidor (DNS aponta pro IP errado / sem vhost)",
  redirect_loop: "Redirecionando para login/portal (não é endpoint Xtream)",
  wrong_protocol: "Protocolo errado (HTTP×HTTPS misturado)",
  auth_required: "Painel vivo, exige autenticação (HTTP 401)",
  server_error: "Erro no servidor de origem (5xx)",
  timeout: "Timeout — servidor não respondeu no prazo",
  refused: "Conexão recusada — porta fechada/serviço parado",
  tls_error: "Erro de TLS/certificado",
  dns_error: "DNS não resolveu",
  unknown_2xx: "Respondeu 2xx mas não é Xtream válido",
};

function diagnoseVariant(r: ProbeResult): string {
  const kind = detectBlockKind(r);
  if (kind) {
    let extra = "";
    const cfRay = h(r, "cf-ray");
    const cfMit = h(r, "cf-mitigated");
    const retryAfter = h(r, "retry-after");
    const server = h(r, "server");
    if (kind === "rate_limit" && retryAfter) extra = ` (Retry-After: ${retryAfter})`;
    else if ((kind === "waf_block" || kind === "ddos_protection") && cfMit) extra = ` (cf-mitigated: ${cfMit})`;
    else if (kind === "ip_block_404_nginx" && cfRay) extra = ` (CF-Ray: ${cfRay.slice(0, 16)}…)`;
    else if (kind === "default_landing" && server) extra = ` (Server: ${server})`;
    return KIND_LABEL[kind] + extra;
  }
  if (r.status) return `HTTP ${r.status} sem padrão reconhecido`;
  if (r.error) return classifyError(r.error);
  return "Sem resposta";
}

function interpretResults(d: ProbeResponse): string {
  const results = d.results;
  if (!results.length) return "Sem variantes testadas.";

  const kinds = results.map(detectBlockKind);
  const allSame = kinds.every((k) => k === kinds[0]) ? kinds[0] : null;

  // Caso unânime
  if (allSame === "xtream_ok") {
    return "✅ Painel está OK e respondendo como Xtream válido em todas as variantes. Credenciais aceitas. Se o app continua sem carregar, o problema é específico do cliente (rede do usuário, codec, ou conta IPTV expirada).";
  }
  if (allSame === "xtream_invalid_creds") {
    return "⚠️ Painel está vivo e respondendo Xtream, mas as credenciais foram REJEITADAS (auth=0). Verifique se o usuário/senha digitados estão corretos ou se a conta foi desabilitada na revenda.";
  }
  if (allSame === "expired_account") {
    return "❌ A CONTA IPTV deste usuário está EXPIRADA ou foi desabilitada pela revenda. O painel está funcionando normalmente — é a assinatura específica que precisa ser renovada.";
  }
  if (allSame === "suspended") {
    return "❌ A conta da HOSPEDAGEM do painel foi SUSPENSA. O servidor retorna 'account suspended' / HTTP 444 para qualquer requisição, de qualquer IP, em todas as variantes (HTTP/HTTPS, com/sem /c/). Não é problema de bloqueio, firewall ou credencial — é desativação na origem.\n\nAções sugeridas:\n  • Verificar status da conta no datacenter/provedor de hospedagem do painel\n  • Possível takedown por denúncia/abuso\n  • Migrar usuários para nova URL/DNS";
  }
  if (allSame === "default_landing") {
    return "⚠️ Em todas as variantes o servidor respondeu com a PÁGINA DEFAULT (nginx/Apache 'Welcome'). Isso indica que o domínio aponta pra um IP correto, mas o painel IPTV NÃO está instalado/configurado nesse host. Provavelmente DNS aponta pro lugar errado ou o painel foi desinstalado.";
  }
  if (allSame === "ddos_protection") {
    return "❌ O painel está atrás de PROTEÇÃO ANTI-DDOS (Cloudflare Challenge / DDoS-Guard) que exige um navegador real executando JavaScript. Backends serverless e bots não conseguem passar pelo challenge. Pra resolver, a revenda precisa colocar o painel em modo 'whitelist API' ou desativar o challenge no path /player_api.php.";
  }
  if (allSame === "waf_block") {
    return "❌ O WAF (firewall de aplicação) do painel está BLOQUEANDO nossas requisições explicitamente. Veja headers cf-mitigated/x-sucuri-id no detalhamento. A revenda precisa adicionar o IP do nosso backend à allowlist do WAF, ou desativar a regra que está bloqueando.";
  }
  if (allSame === "rate_limit") {
    return "❌ Atingimos o RATE LIMIT do painel (HTTP 429). O servidor está limitando requisições por IP/minuto. Reduzir frequência de chamadas ou pedir à revenda para aumentar o limite para o IP do nosso backend.";
  }
  if (allSame === "geoblock") {
    return "❌ Bloqueio GEOGRÁFICO ativo. O painel só aceita conexões de países/regiões específicas e nosso backend (datacenter US/EU) está fora dessa lista. Resolveria com VPS no Brasil ou pedindo à revenda pra liberar o país do nosso datacenter.";
  }
  if (allSame === "ip_block_403") {
    return "❌ Todas as variantes retornaram HTTP 403 Forbidden. Nosso IP de origem está EXPLICITAMENTE bloqueado por ACL/firewall do painel. Painel funciona em outros IPs. Solução: VPS com IP residencial brasileiro ou liberar nosso IP na revenda.";
  }
  if (allSame === "ip_block_404_nginx") {
    return "❌ Todas as variantes retornaram HTTP 404 (nginx/cloudflare). Duas leituras possíveis:\n  (a) O painel está vivo mas o endpoint Xtream (/player_api.php) não existe nesse caminho — confirmar URL correta com a revenda.\n  (b) O painel está bloqueando ATIVAMENTE nosso range de IPs (datacenter) e devolvendo 404 como resposta de bloqueio disfarçado.\n\nSe o painel funciona em IPs residenciais brasileiros mas não no nosso, é o caso (b) — solução: VPS BR ou whitelist de IP.";
  }
  if (allSame === "ip_block_reset") {
    return "❌ Todas as conexões foram CORTADAS pelo servidor (Reset by peer / TCP RST). Indica filtro anti-datacenter ativo no painel — ele aceita conexões de IPs residenciais mas bloqueia ranges de cloud (Supabase, AWS, GCP, Cloudflare). Painel está vivo, mas inacessível pra qualquer backend serverless.";
  }
  if (allSame === "timeout") {
    return "❌ Todas as variantes deram TIMEOUT. Servidor não respondeu no prazo. Pode estar offline, sobrecarregado ou com firewall silencioso (DROP em vez de REJECT).";
  }
  if (allSame === "refused") {
    return "❌ Conexão recusada em todas as portas/protocolos. Servidor desligado, serviço HTTP/HTTPS parado, ou portas 80/443 fechadas no firewall.";
  }
  if (allSame === "tls_error") {
    return "❌ Erro de TLS/certificado em todas as variantes HTTPS. Certificado expirado, inválido ou hostname não bate com o CN/SAN. Pode tentar via HTTP se o painel suportar.";
  }
  if (allSame === "dns_error") {
    return "❌ O domínio não resolveu DNS. Pode ter sido removido (takedown), o domínio expirou, ou está apontando pra registros inválidos.";
  }
  if (allSame === "auth_required") {
    return "⚠️ Painel respondeu mas exige autenticação válida (401). Servidor está vivo. Credenciais usadas no teste podem estar erradas, ou o IP precisa estar em allowlist antes de autenticar.";
  }
  if (allSame === "server_error") {
    return "❌ Servidor retornou erro 5xx em todas as variantes. Painel está com problema interno (banco caiu, php-fpm parado, disco cheio). É problema do hosting, não do nosso lado.";
  }

  // Casos parcialmente ok
  if (kinds.some((k) => k === "xtream_ok")) {
    const okList = results.filter((_, i) => kinds[i] === "xtream_ok").map((r) => r.variant);
    return `✅ Pelo menos uma variante respondeu Xtream OK:\n  ${okList.join("\n  ")}\n\nUse essa(s) URL(s) na configuração. As outras variantes falharam mas não impedem o funcionamento.`;
  }
  if (kinds.some((k) => k === "auth_required")) {
    return "⚠️ Algumas variantes respondem 401 (servidor vivo, exige login) mas nenhuma respondeu como Xtream válido. Verifique se a URL do painel está correta e se as credenciais são válidas.";
  }

  // Misto sem padrão claro
  const summary = new Map<string, number>();
  kinds.forEach((k) => {
    const label = k ? KIND_LABEL[k] : "Sem diagnóstico";
    summary.set(label, (summary.get(label) ?? 0) + 1);
  });
  const breakdown = Array.from(summary.entries()).map(([k, c]) => `  • ${c}× ${k}`).join("\n");
  return `⚠️ Resultado MISTO entre as variantes — nenhum padrão único de bloqueio:\n${breakdown}\n\nVeja o detalhamento por variante acima. Pode indicar painel parcialmente disponível, bloqueio seletivo por porta/protocolo, ou configuração inconsistente do servidor.`;
}

function buildReport(d: ProbeResponse, label: string | null | undefined): string {
  const now = new Date();
  const tzMin = -now.getTimezoneOffset();
  const tzSign = tzMin >= 0 ? "+" : "-";
  const tzAbs = Math.abs(tzMin);
  const tzStr = `UTC${tzSign}${pad(Math.floor(tzAbs / 60))}:${pad(tzAbs % 60)}`;

  const sep = "═".repeat(55);
  const sub = "─".repeat(55);

  const lines: string[] = [];
  lines.push(sep);
  lines.push("RELATÓRIO DE DIAGNÓSTICO DE SERVIDOR IPTV");
  lines.push(sep);
  lines.push("");
  lines.push(`Data/Hora do teste : ${fmtTimestamp(now)} (${tzStr})`);
  lines.push(`Servidor testado   : ${d.server_url}`);
  if (label) lines.push(`Identificação      : ${label}`);
  lines.push(`URL normalizada    : ${d.normalized}`);
  lines.push(`Origem do teste    : Backend Lovable Cloud (datacenter, IPv4)`);
  lines.push("");
  lines.push(sub);
  lines.push("RESULTADO RESUMIDO");
  lines.push(sub);
  if (d.best_variant) {
    lines.push(`Status geral       : ✅ RESPONDEU`);
    lines.push(`Melhor variante    : ${d.best_variant}`);
    if (d.best_status != null) lines.push(`Melhor HTTP status : ${d.best_status}`);
  } else {
    lines.push(`Status geral       : ❌ NENHUMA VARIANTE RESPONDEU OK`);
  }
  lines.push(`Variantes testadas : ${d.tested_variants}`);
  lines.push(`Timeout por teste  : ${d.timeout_ms}ms`);
  lines.push("");
  lines.push(sub);
  lines.push("DETALHAMENTO POR VARIANTE");
  lines.push(sub);
  d.results.forEach((r, idx) => {
    lines.push("");
    lines.push(`[${idx + 1}] ${r.variant}`);
    lines.push(`    HTTP Status   : ${r.status ?? "—"}`);
    lines.push(`    Latência      : ${r.latency_ms}ms`);
    lines.push(`    Xtream válido : ${r.is_xtream ? "sim" : "não"}`);
    if (r.auth !== null && r.auth !== undefined) lines.push(`    auth=         : ${r.auth}`);
    if (r.error) lines.push(`    Erro técnico  : ${r.error.length > 200 ? r.error.slice(0, 200) + "…" : r.error}`);
    lines.push(`    Diagnóstico   : ${diagnoseVariant(r)}`);
    if (r.headers && Object.keys(r.headers).length > 0) {
      const interesting = ["server", "cf-ray", "cf-mitigated", "cf-cache-status", "x-powered-by", "retry-after", "x-ratelimit-remaining", "x-sucuri-id", "via", "location"];
      const hdrs = interesting
        .map((k) => {
          const v = h(r, k);
          return v ? `${k}: ${v.length > 80 ? v.slice(0, 80) + "…" : v}` : null;
        })
        .filter(Boolean);
      if (hdrs.length > 0) lines.push(`    Headers       : ${hdrs.join(" | ")}`);
    }
    if (r.body_preview) {
      const preview = r.body_preview.length > 200 ? r.body_preview.slice(0, 200) + "…" : r.body_preview;
      lines.push(`    Resposta      : "${preview.replace(/\s+/g, " ").trim()}"`);
    }
  });
  lines.push("");
  lines.push(sub);
  lines.push("INTERPRETAÇÃO");
  lines.push(sub);
  lines.push(interpretResults(d));
  lines.push("");
  lines.push(sep);
  lines.push("Gerado por: Webplayer Admin");
  lines.push(sep);

  return lines.join("\n");
}

function buildClientSection(c: ClientProbeResult): string {
  const sub = "─".repeat(55);
  const lines: string[] = [];
  lines.push("");
  lines.push(sub);
  lines.push("TESTE CLIENT-SIDE (do seu navegador / IP residencial)");
  lines.push(sub);
  lines.push(`Executado em      : ${c.ran_at}`);
  lines.push(`Página em HTTPS   : ${c.page_is_https ? "sim (alvos http:// usam fallback via <img>)" : "não"}`);
  const conclusivos = c.attempts.filter((a) => a.state !== "blocked_mixed").length;
  lines.push(`Variantes testadas: ${c.attempts.length} (${conclusivos} conclusivas)`);
  lines.push(`Resultado         : ${c.any_reachable ? "✅ Servidor ALCANÇÁVEL do seu IP" : conclusivos === 0 ? "⚠️ INCONCLUSIVO (todas bloqueadas por mixed content)" : "❌ Servidor INACESSÍVEL também do seu IP"}`);
  c.attempts.forEach((a, i) => {
    const icon = a.state === "reachable" ? "✅ acessível" : a.state === "blocked_mixed" ? "⚠️ inconclusivo" : "❌ inacessível";
    lines.push(`  [${i + 1}] ${a.variant}`);
    lines.push(`      Estado    : ${icon} (${a.latency_ms}ms · método: ${a.method})`);
    lines.push(`      Detalhe   : ${a.detail}`);
  });
  return lines.join("\n");
}

function buildComparisonVerdict(backend: ProbeResponse, client: ClientProbeResult): string {
  const backendOk = !!backend.best_variant;
  const clientOk = client.any_reachable;
  const conclusivos = client.attempts.filter((a) => a.state !== "blocked_mixed").length;
  if (conclusivos === 0) {
    return "⚠️ Teste client-side INCONCLUSIVO — todas as variantes HTTP foram bloqueadas pelo navegador (Mixed Content, página em HTTPS). Para teste conclusivo, abra o painel num navegador HTTP ou use a versão app/desktop. O resultado do backend continua válido.";
  }
  if (!backendOk && clientOk) {
    return "🎯 BLOQUEIO ANTI-DATACENTER CONFIRMADO\n  • Backend (datacenter) NÃO conseguiu acessar o servidor\n  • Seu navegador (IP residencial) ALCANÇOU o servidor\n  • Conclusão: o painel está vivo, mas filtra ranges de cloud/datacenter\n  • Solução: usar proxy em IP residencial brasileiro, ou pedir à revenda whitelist do nosso IP de backend";
  }
  if (backendOk && !clientOk) {
    return "⚠️ Inverso: backend acessa mas seu navegador não. Pode ser problema de DNS/rede local do seu lado, firewall corporativo ou ISP bloqueando.";
  }
  if (!backendOk && !clientOk) {
    return "❌ Servidor inacessível DE QUALQUER ORIGEM (backend e seu IP). Provavelmente está realmente offline, derrubado, ou domínio expirado/removido.";
  }
  return "✅ Servidor acessível tanto do backend quanto do seu navegador. Sem indicação de bloqueio por origem.";
}

// ============================================================
// AÇÃO 4 — Recomendação automática + email pronto
// ============================================================

type RecommendationTarget = "supplier" | "reseller" | "end_user" | "config" | "none";
type RecommendationPriority = "alta" | "media" | "baixa";

interface RecommendationResult {
  title: string;
  action: string;
  target: RecommendationTarget;
  targetLabel: string;
  priority: RecommendationPriority;
  resellerWarning?: string;
  message?: string;
}

function unanimousKind(d: ProbeResponse): NonNullable<BlockKind> | null {
  if (!d.results.length) return null;
  const kinds = d.results.map(detectBlockKind);
  const first = kinds[0];
  if (!first) return null;
  return kinds.every((k) => k === first) ? first : null;
}

function backendLatencyHint(d: ProbeResponse): string {
  const lat = d.results.find((r) => r.latency_ms > 0)?.latency_ms;
  return lat ? `${lat}ms` : "tempo de resposta variável";
}

function clientLatencyHint(c: ClientProbeResult | null): string | null {
  if (!c) return null;
  const reach = c.attempts.find((a) => a.state === "reachable");
  return reach ? `${reach.latency_ms}ms (${reach.variant})` : null;
}

function listClosedPorts(d: ProbeResponse): string {
  const closed = d.results
    .filter((r) => /refused|os error 111/i.test(r.error || ""))
    .map((r) => {
      try {
        const u = new URL(r.variant);
        return u.port || (u.protocol === "https:" ? "443" : "80");
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const uniq = Array.from(new Set(closed));
  return uniq.length ? uniq.join(", ") : "—";
}

function buildRecommendation(
  d: ProbeResponse,
  c: ClientProbeResult | null,
  serverUrl: string,
  serverLabel: string | null | undefined,
): RecommendationResult | null {
  const backendOk = !!d.best_variant;
  const clientConclusivos = c ? c.attempts.filter((a) => a.state !== "blocked_mixed").length : 0;
  const clientOk = !!c && c.any_reachable && clientConclusivos > 0;
  const kind = unanimousKind(d);
  const host = (() => {
    try { return new URL(d.normalized).hostname; } catch { return serverUrl; }
  })();
  const labelPart = serverLabel ? ` (${serverLabel})` : "";

  // Caso 1: Bloqueio anti-datacenter confirmado
  if (!backendOk && clientOk) {
    const backendLat = backendLatencyHint(d);
    const clientLat = clientLatencyHint(c);
    const closedPorts = listClosedPorts(d);
    const message =
`Olá,

Identificamos que o servidor ${serverUrl}${labelPart} está bloqueando ativamente conexões originadas de IPs de datacenter/cloud, mas aceita conexões de IPs residenciais brasileiros normalmente.

Evidência técnica do nosso diagnóstico:
  • Backend (cloud): conexão recusada/cortada em ~${backendLat}${clientLat ? `\n  • Navegador residencial: pacote aceito em ~${clientLat}` : ""}
  • Portas testadas e fechadas para cloud: ${closedPorts}

Isso impede que o painel funcione em qualquer aplicativo web hospedado em nuvem (Vercel, AWS, Cloudflare, Supabase, etc.).

Solicitamos uma das opções a seguir:
  1. Adicionar nosso range de IPs à whitelist do firewall do painel
  2. Desativar a regra anti-datacenter para o endpoint /player_api.php
  3. Confirmar se há um endpoint/proxy alternativo para integrações web

Posso enviar o relatório técnico completo se for útil.

Atenciosamente.`;
    return {
      title: "🎯 Pedir whitelist ao fornecedor",
      action: "Contatar o fornecedor do painel para liberar IPs de cloud no firewall.",
      target: "supplier",
      targetLabel: `Dono/admin do painel ${host}`,
      priority: "alta",
      resellerWarning:
        "Este servidor NÃO funciona em apps web (datacenter blocked). Recomende aos revendedores que o substituam ou aguardem liberação do whitelist antes de cadastrar novos clientes.",
      message,
    };
  }

  // Caso 2: WAF / DDoS challenge
  if (kind === "waf_block" || kind === "ddos_protection" || kind === "waf_challenge") {
    const message =
`Olá,

O painel ${serverUrl}${labelPart} está com WAF/proteção anti-DDoS ativa que exige um navegador real executando JavaScript. Isso impede integração com qualquer backend serverless ou aplicativo web.

Diagnóstico: ${KIND_LABEL[kind]}.

Solicitamos:
  1. Desativar o challenge no endpoint /player_api.php (modo "API allowlist")
  2. OU adicionar nosso range de IPs à allowlist do WAF
  3. OU informar um endpoint alternativo de integração

Atenciosamente.`;
    return {
      title: kind === "ddos_protection" ? "🛡️ Pedir liberação do anti-DDoS" : "🛡️ Pedir liberação do WAF",
      action: "Pedir ao fornecedor pra desativar challenge no /player_api.php ou liberar nosso IP.",
      target: "supplier",
      targetLabel: `Dono/admin do painel ${host}`,
      priority: "alta",
      resellerWarning:
        "Servidor exige challenge de browser real — não funciona em backends. Suspender cadastros novos até liberação.",
      message,
    };
  }

  // Caso 3: 403/404 unânime (IP block)
  if (kind === "ip_block_403" || kind === "ip_block_404_nginx") {
    const message =
`Olá,

O painel ${serverUrl}${labelPart} está retornando ${kind === "ip_block_403" ? "HTTP 403 Forbidden" : "HTTP 404 (nginx/cloudflare)"} em TODAS as variantes testadas a partir do nosso backend de cloud.

Isso indica que nosso range de IPs está bloqueado por ACL/firewall do painel.

Solicitamos liberar nosso IP de backend na allowlist, ou desativar a regra que está retornando ${kind === "ip_block_403" ? "403" : "404"} para datacenters.

Atenciosamente.`;
    return {
      title: kind === "ip_block_403" ? "🚫 Liberar IP (403 Forbidden)" : "🚫 Liberar IP (404 disfarçado)",
      action: "Pedir ao fornecedor pra adicionar nosso IP de backend na allowlist.",
      target: "supplier",
      targetLabel: `Dono/admin do painel ${host}`,
      priority: "alta",
      resellerWarning: "Servidor bloqueia nosso range de IPs. Não cadastrar novos clientes até liberação.",
      message,
    };
  }

  // Caso 4: Geoblock
  if (kind === "geoblock") {
    const message =
`Olá,

O painel ${serverUrl}${labelPart} está com bloqueio geográfico que recusa conexões da região do nosso datacenter.

Solicitamos liberar a região onde rodamos nosso backend, ou nos informar quais países estão na allowlist atual.

Atenciosamente.`;
    return {
      title: "🌍 Pedir liberação geográfica",
      action: "Pedir ao fornecedor pra incluir o país/região do nosso datacenter na allowlist.",
      target: "supplier",
      targetLabel: `Dono/admin do painel ${host}`,
      priority: "alta",
      resellerWarning: "Painel só aceita conexões de regiões específicas. Confirmar com fornecedor antes de novos cadastros.",
      message,
    };
  }

  // Caso 5: Rate limit
  if (kind === "rate_limit") {
    const message =
`Olá,

Estamos atingindo o rate limit do painel ${serverUrl}${labelPart} (HTTP 429). Pedimos que aumentem o limite de requisições por minuto para o nosso IP de backend, ou que nos informem o limite atual para que possamos ajustar a frequência das chamadas.

Atenciosamente.`;
    return {
      title: "⏱️ Pedir aumento de rate limit",
      action: "Pedir ao fornecedor pra aumentar limite de requisições para nosso IP.",
      target: "supplier",
      targetLabel: `Dono/admin do painel ${host}`,
      priority: "media",
      message,
    };
  }

  // Caso 6: Hospedagem suspensa
  if (kind === "suspended") {
    return {
      title: "🛑 Hospedagem do painel SUSPENSA",
      action: "Migrar usuários para nova URL — não há solução do lado do cliente.",
      target: "reseller",
      targetLabel: "Revenda / equipe interna",
      priority: "alta",
      resellerWarning:
        "A conta da hospedagem deste painel foi suspensa na origem (possível takedown ou inadimplência). Painel não voltará. Comunicar revendedores e migrar clientes para outra URL.",
    };
  }

  // Caso 7: Conta IPTV expirada
  if (kind === "expired_account") {
    return {
      title: "💳 Renovar assinatura IPTV",
      action: "Avisar usuário/revenda que a assinatura individual expirou.",
      target: "end_user",
      targetLabel: "Usuário final / revenda",
      priority: "media",
      message:
`Olá,

A assinatura IPTV neste painel (${host}${labelPart}) consta como EXPIRADA ou desabilitada. O painel está funcionando normalmente — apenas a sua conta precisa ser renovada com a revenda.

Por favor, entre em contato com quem te vendeu o acesso para renovar.

Atenciosamente.`,
    };
  }

  // Caso 8: Credenciais inválidas
  if (kind === "xtream_invalid_creds") {
    return {
      title: "🔑 Credenciais inválidas",
      action: "Conferir usuário e senha — o servidor está respondendo, mas auth=0.",
      target: "end_user",
      targetLabel: "Usuário final / revenda",
      priority: "baixa",
      message:
`Olá,

O painel ${host}${labelPart} está respondendo normalmente, mas as credenciais informadas (usuário/senha) foram REJEITADAS. Confira se digitou corretamente, ou peça à revenda para confirmar/redefinir suas credenciais.

Atenciosamente.`,
    };
  }

  // Caso 9: DNS error
  if (kind === "dns_error") {
    return {
      title: "📡 Domínio não resolve (DNS)",
      action: "Confirmar com o fornecedor se o domínio mudou ou foi removido.",
      target: "supplier",
      targetLabel: `Fornecedor do painel ${host}`,
      priority: "alta",
      resellerWarning:
        "O domínio deste painel não resolve mais via DNS. Pode ter sido removido (takedown), expirado, ou trocado. Suspender uso até confirmação.",
    };
  }

  // Caso 10: Default landing
  if (kind === "default_landing") {
    return {
      title: "🌐 DNS aponta para o lugar errado",
      action: "Pedir ao fornecedor pra confirmar a URL correta do painel.",
      target: "supplier",
      targetLabel: `Fornecedor do painel ${host}`,
      priority: "media",
      message:
`Olá,

A URL ${serverUrl}${labelPart} responde com a página default do servidor web (nginx/Apache "Welcome"), o que indica que o painel IPTV não está instalado nesse host, ou o DNS está apontando para o IP errado.

Podem confirmar a URL correta do painel?

Atenciosamente.`,
    };
  }

  // Caso 11: Tudo offline
  if (!backendOk && c && !clientOk && clientConclusivos > 0) {
    return {
      title: "⛔ Servidor inacessível de qualquer origem",
      action: "Servidor parece realmente offline — confirmar com fornecedor.",
      target: "supplier",
      targetLabel: `Fornecedor do painel ${host}`,
      priority: "alta",
      resellerWarning:
        "Servidor não responde nem do nosso backend nem do IP residencial do admin. Provavelmente offline. Suspender uso até retorno.",
    };
  }

  // Caso 12: Funcionou
  if (kind === "xtream_ok" || (backendOk && d.results.some((r) => r.is_xtream))) {
    return {
      title: "✅ Use a URL detectada",
      action: `Configure o painel usando a variante: ${d.best_variant ?? "(ver detalhamento)"}.`,
      target: "config",
      targetLabel: "Configuração interna",
      priority: "baixa",
    };
  }

  return null;
}

function targetLabelText(t: RecommendationTarget): string {
  switch (t) {
    case "supplier": return "Fornecedor do painel";
    case "reseller": return "Revenda / equipe interna";
    case "end_user": return "Usuário final";
    case "config": return "Configuração interna";
    default: return "—";
  }
}

function priorityLabelText(p: RecommendationPriority): string {
  switch (p) {
    case "alta": return "Alta";
    case "media": return "Média";
    case "baixa": return "Baixa";
  }
}

function buildRecommendationSection(rec: RecommendationResult): string {
  const sub = "─".repeat(55);
  const lines: string[] = [];
  lines.push("");
  lines.push(sub);
  lines.push("RECOMENDAÇÃO AUTOMÁTICA");
  lines.push(sub);
  lines.push("");
  lines.push(`Ação sugerida    : ${rec.action}`);
  lines.push(`Responsável      : ${rec.targetLabel} (${targetLabelText(rec.target)})`);
  lines.push(`Prioridade       : ${priorityLabelText(rec.priority)}`);
  if (rec.resellerWarning) {
    lines.push(`Aviso revendas   : ⚠️ ${rec.resellerWarning}`);
  }
  if (rec.message) {
    lines.push("");
    lines.push("─── MENSAGEM PRONTA PARA COPIAR E ENVIAR ───");
    lines.push("");
    lines.push(rec.message);
  }
  return lines.join("\n");
}

export function ServerProbeDialog({ open, onOpenChange, serverUrl, serverLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProbeResponse | null>(null);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientData, setClientData] = useState<ClientProbeResult | null>(null);
  const [blockedDnsDialogOpen, setBlockedDnsDialogOpen] = useState(false);

  const runProbe = async () => {
    if (!serverUrl) return;
    setLoading(true);
    setData(null);
    try {
      const { data: res, error } = await supabase.functions.invoke<ProbeResponse>("admin-api", {
        body: { action: "probe_server", payload: { server_url: serverUrl } },
      });
      if (error) throw error;
      if (!res) throw new Error("Resposta vazia");
      setData(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao testar conexão";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const runClientTest = async () => {
    if (!serverUrl) return;
    setClientLoading(true);
    setClientData(null);
    try {
      const res = await runClientProbe(serverUrl);
      setClientData(res);
      const conclusivos = res.attempts.filter((a) => a.state !== "blocked_mixed").length;
      if (conclusivos === 0) {
        toast.warning("Inconclusivo: app está em HTTPS e o navegador bloqueou os testes HTTP (Mixed Content)");
      } else if (res.any_reachable && data && !data.best_variant) {
        toast.success("Bloqueio anti-datacenter confirmado: servidor responde ao seu IP");
      } else if (res.any_reachable) {
        toast.success("Servidor alcançável do seu navegador");
      } else {
        toast.error("Servidor inacessível também do seu navegador");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no teste client-side";
      toast.error(msg);
    } finally {
      setClientLoading(false);
    }
  };

  const recommendation =
    data ? buildRecommendation(data, clientData, serverUrl ?? "", serverLabel) : null;

  const handleCopyReport = async () => {
    if (!data) return;
    let text = buildReport(data, serverLabel);
    if (clientData) {
      text += "\n" + buildClientSection(clientData);
      text += "\n\n─── VEREDITO COMPARATIVO ───\n" + buildComparisonVerdict(data, clientData);
    }
    if (recommendation) {
      text += "\n" + buildRecommendationSection(recommendation);
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Relatório copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar. Use 'Baixar .txt' como alternativa.");
    }
  };

  const handleCopyMessageOnly = async () => {
    if (!recommendation?.message) return;
    try {
      await navigator.clipboard.writeText(recommendation.message);
      toast.success("Mensagem copiada — pronta pra colar no email/WhatsApp");
    } catch {
      toast.error("Não foi possível copiar a mensagem.");
    }
  };

  const handleDownloadReport = () => {
    if (!data) return;
    let text = buildReport(data, serverLabel);
    if (clientData) {
      text += "\n" + buildClientSection(clientData);
      text += "\n\n─── VEREDITO COMPARATIVO ───\n" + buildComparisonVerdict(data, clientData);
    }
    if (recommendation) {
      text += "\n" + buildRecommendationSection(recommendation);
    }
    let host = "servidor";
    try {
      host = new URL(data.normalized).hostname.replace(/[^a-z0-9.-]/gi, "_");
    } catch {
      /* ignore */
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `diagnostico-${host}-${ts}.txt`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Relatório salvo: ${filename}`);
  };

  // Auto-run quando abre
  useEffect(() => {
    if (open && serverUrl) {
      runProbe();
      setClientData(null);
    } else if (!open) {
      setData(null);
      setClientData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serverUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Testar conexão
          </DialogTitle>
          <DialogDescription>
            {serverLabel && <span className="font-semibold">{serverLabel}</span>}
            {serverLabel && " · "}
            <span className="font-mono">{serverUrl}</span>
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Testando todas as portas e protocolos…
            </p>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="rounded-lg border border-border/50 p-4 bg-muted/30">
              {data.best_variant ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-semibold text-success">Servidor está vivo</span>
                  </div>
                  <p className="text-sm">
                    Melhor variante:{" "}
                    <span className="font-mono text-primary">{data.best_variant}</span>
                  </p>
                  {data.best_status != null && (
                    <p className="text-xs text-muted-foreground">
                      Última resposta: HTTP {data.best_status}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="font-semibold text-destructive">
                      Nenhuma porta respondeu
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Servidor pode estar offline, com firewall bloqueando nosso IP, ou só
                    aceitar conexões geo-localizadas. Confirme com a revenda.
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {data.tested_variants} variantes testadas · timeout {data.timeout_ms}ms
                cada
              </p>
            </div>

            {/* Resultados por variante */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Resultado por porta/protocolo
              </h3>
              <div className="space-y-2">
                {data.results.map((r) => (
                  <div
                    key={r.variant}
                    className={`rounded-md border p-3 ${
                      r.is_xtream || r.status === 401
                        ? "border-success/30 bg-success/5"
                        : r.status && r.status < 500
                          ? "border-warning/30 bg-warning/5"
                          : "border-border/50 bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-mono text-sm break-all">{r.variant}</span>
                      <div className="flex items-center gap-2">
                        {statusBadge(r)}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {r.latency_ms}ms
                        </span>
                      </div>
                    </div>
                    {r.error && (
                      <p className="text-xs text-destructive/80 mt-1 break-all">
                        {classifyError(r.error)}
                      </p>
                    )}
                    {r.body_preview && r.is_xtream && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        Resposta Xtream válida (auth={String(r.auth)})
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Teste client-side */}
            <div className="rounded-lg border border-border/50 p-4 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Teste do seu navegador (IP residencial)</h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={runClientTest}
                  disabled={clientLoading || !serverUrl}
                >
                  {clientLoading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Globe className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Testar do meu navegador
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Compara o resultado do backend (datacenter) com o seu IP residencial. Se o backend falha mas seu navegador alcança, é bloqueio anti-datacenter.
              </p>

              {clientData && (() => {
                const conclusivos = clientData.attempts.filter((a) => a.state !== "blocked_mixed").length;
                const allMixed = conclusivos === 0;
                return (
                  <div className="space-y-2">
                    <div
                      className={`rounded-md border p-2 text-sm ${
                        allMixed
                          ? "border-warning/40 bg-warning/10"
                          : !data?.best_variant && clientData.any_reachable
                            ? "border-warning/40 bg-warning/10"
                            : clientData.any_reachable
                              ? "border-success/30 bg-success/5"
                              : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      {allMixed && (
                        <>
                          <p className="font-semibold text-warning">⚠️ Inconclusivo (Mixed Content)</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            App está em HTTPS e o navegador bloqueou as variantes HTTP. O resultado do backend continua válido.
                          </p>
                        </>
                      )}
                      {!allMixed && !data?.best_variant && clientData.any_reachable && (
                        <p className="font-semibold text-warning">🎯 Bloqueio anti-datacenter confirmado</p>
                      )}
                      {!allMixed && data?.best_variant && clientData.any_reachable && (
                        <p className="font-semibold text-success">✅ Acessível em ambas origens</p>
                      )}
                      {!allMixed && !clientData.any_reachable && (
                        <p className="font-semibold text-destructive">❌ Inacessível também do seu IP</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      {clientData.attempts.map((a) => {
                        const color =
                          a.state === "reachable"
                            ? "text-success"
                            : a.state === "blocked_mixed"
                              ? "text-warning"
                              : "text-destructive";
                        const icon =
                          a.state === "reachable" ? "✓" : a.state === "blocked_mixed" ? "⚠" : "✗";
                        return (
                          <div
                            key={a.variant}
                            className="text-xs rounded border border-border/40 bg-background/40 px-2 py-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono break-all">{a.variant}</span>
                              <span className={`tabular-nums ${color}`}>
                                {icon} {a.latency_ms}ms
                              </span>
                            </div>
                            <p className={`mt-0.5 ${color} opacity-80`}>{a.detail}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Recomendação automática (Ação 4) */}
            {recommendation && (
              <div
                className={`rounded-lg border p-4 space-y-3 ${
                  recommendation.priority === "alta"
                    ? "border-warning/40 bg-warning/10"
                    : recommendation.priority === "media"
                      ? "border-primary/30 bg-primary/5"
                      : "border-success/30 bg-success/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Lightbulb
                    className={`h-5 w-5 mt-0.5 shrink-0 ${
                      recommendation.priority === "alta"
                        ? "text-warning"
                        : recommendation.priority === "media"
                          ? "text-primary"
                          : "text-success"
                    }`}
                  />
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-semibold">{recommendation.title}</h3>
                    <p className="text-sm text-foreground/90">{recommendation.action}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-border/40 bg-background/40 px-2 py-1.5">
                    <span className="text-muted-foreground">Responsável: </span>
                    <span className="font-medium">{recommendation.targetLabel}</span>
                  </div>
                  <div className="rounded border border-border/40 bg-background/40 px-2 py-1.5">
                    <span className="text-muted-foreground">Prioridade: </span>
                    <span
                      className={`font-medium ${
                        recommendation.priority === "alta"
                          ? "text-warning"
                          : recommendation.priority === "media"
                            ? "text-primary"
                            : "text-success"
                      }`}
                    >
                      {priorityLabelText(recommendation.priority)}
                    </span>
                  </div>
                </div>

                {recommendation.resellerWarning && (
                  <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-foreground/90">
                      <span className="font-semibold text-destructive">Aviso para revendas: </span>
                      {recommendation.resellerWarning}
                    </p>
                  </div>
                )}

                {recommendation.message && (
                  <div className="space-y-2">
                    <details className="rounded border border-border/40 bg-background/40">
                      <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                        Ver mensagem pronta para enviar
                      </summary>
                      <pre className="whitespace-pre-wrap break-words px-2 py-2 text-xs text-foreground/90 border-t border-border/40">
{recommendation.message}
                      </pre>
                    </details>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyMessageOnly}
                        className="w-full sm:w-auto"
                      >
                        <Mail className="h-3.5 w-3.5 mr-1.5" />
                        Copiar mensagem para enviar
                      </Button>
                      {recommendation.target === "supplier" && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setBlockedDnsDialogOpen(true)}
                          className="w-full sm:w-auto"
                        >
                          <Ban className="h-3.5 w-3.5 mr-1.5" />
                          Catalogar como DNS bloqueado
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}


        <DialogFooter className="gap-2 flex-wrap sm:flex-nowrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadReport}
            disabled={loading || !data}
            title="Baixar relatório como arquivo .txt"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar .txt
          </Button>
          <Button
            variant="secondary"
            onClick={handleCopyReport}
            disabled={loading || !data}
            title="Copiar relatório para enviar à revenda"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar relatório
          </Button>
          <Button onClick={runProbe} disabled={loading || !serverUrl}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Testar novamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
