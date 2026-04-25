import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Hls, { type ErrorData } from "hls.js";
import { Tv, AlertTriangle, Copy, Check, RefreshCw, X, Loader2, ExternalLink, Activity, Terminal, Trash2, VideoOff, ListVideo, Zap, Rewind, FastForward, Gauge, Flag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportProblemDialog, type ReportSnapshot } from "@/components/ReportProblemDialog";
import { markIncompatible, hostFromUrl } from "@/lib/incompatibleContent";

/**
 * Motor de reprodução para canais ao vivo.
 * - hls     : padrão (hls.js sobre .m3u8)
 * - mpegts  : mpegts.js com fallback automático .ts → .m3u8
 * - external: oculta vídeo, oferece "Abrir no VLC" + copiar URL
 */
type PlaybackEngine = "hls" | "mpegts" | "external";

const ENGINE_LABEL: Record<PlaybackEngine, string> = {
  hls: "HLS",
  mpegts: "MPEG-TS",
  external: "Externo",
};

const ENGINE_STORAGE_PREFIX = "player.engine.host:";
const MPEGTS_BOOTSTRAP_TIMEOUT_MS = 8_000;

function safeHostFromUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try { return new URL(u).host.toLowerCase(); } catch { return null; }
}

function getPreferredEngine(host: string | null): PlaybackEngine | null {
  if (!host) return null;
  try {
    const v = localStorage.getItem(`${ENGINE_STORAGE_PREFIX}${host}`);
    if (v === "hls" || v === "mpegts" || v === "external") return v;
  } catch { /* noop */ }
  return null;
}

function setPreferredEngine(host: string | null, engine: PlaybackEngine) {
  if (!host) return;
  try { localStorage.setItem(`${ENGINE_STORAGE_PREFIX}${host}`, engine); }
  catch { /* noop */ }
}

/** Detecta canal ao vivo Xtream: /live/<u>/<p>/<id>.m3u8 */
function isLiveXtreamUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\/live\/[^/]+\/[^/]+\/\d+\.(m3u8|ts)(\?|$)/i.test(url);
}

/** Troca .m3u8 → .ts apenas para padrão Xtream live. Caso contrário devolve original. */
function toMpegtsTsUrl(url: string): string | null {
  if (!isLiveXtreamUrl(url)) return null;
  if (/\.ts(\?|$)/i.test(url)) return url;
  return url.replace(/\.m3u8(\?|$)/i, ".ts$1");
}
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getPlaybackStrategy,
  isValidStreamUrl,
  normalizeExt,
  requestStreamToken,
  reportStreamEvent,
  getHostProxyMode,
  markHostProxyRequired,
  type PlaybackStrategy,
  type StreamMode,
} from "@/services/iptv";
import { useIptv } from "@/context/IptvContext";
import { cn } from "@/lib/utils";

interface PlayerProps {
  /** URL bruta do stream (sem proxy). Player se encarrega de obter token. */
  src?: string | null;
  /** Mantido para compat — mesma URL crua copiada/aberta externamente. */
  rawUrl?: string;
  /** Extensão do container (mp4, m3u8, mkv, etc). */
  containerExt?: string;
  poster?: string;
  title?: string;
  autoPlay?: boolean;
  onClose?: () => void;
  /**
   * Identificador do conteúdo (stream_id do filme/episódio). Usado para
   * marcar localmente como "incompatível" quando o navegador rejeita o
   * codec, evitando novas tentativas que sabemos que vão falhar.
   */
  streamId?: number | string | null;
  /** Tipo lógico do conteúdo (movie/episode/live), só pra reporte ao admin. */
  contentKind?: "movie" | "episode" | "live";
}

type PlayerError = {
  title?: string;
  description?: string;
  copyUrl: string;
  external?: boolean;
  /** Show "Trocar canal" action and dedicated empty-stream messaging. */
  noData?: boolean;
};

type DiagnosticStatus =
  | "connecting"
  | "playback_started"
  | "stall_timeout"
  | "codec_incompatible"
  | "stream_error"
  | "stream_no_data";

type LogSource = "hls" | "video" | "diag" | "net";
type LogLevel = "info" | "warn" | "error";
/**
 * Snapshot rico do estado do player capturado em todo log. Permite
 * diagnosticar pós-mortem stalls, falhas de buffer e travas de rede sem
 * precisar reproduzir o problema. Todos os campos são opcionais — só
 * preenchidos quando aplicáveis.
 */
type LogMeta = {
  /** video.currentTime em segundos */
  ct?: number;
  /** maior fim de buffered, ou null se vazio */
  be?: number;
  /** segundos de buffer à frente de currentTime */
  bAhead?: number;
  /** video.readyState (0-4) */
  rs?: number;
  /** video.networkState (0-3) */
  ns?: number;
  /** video.paused */
  p?: boolean;
  /** HTTP status code (eventos de rede) */
  http?: number;
  /** Bytes carregados (frag/level) */
  bytes?: number;
  /** Tempo total de carregamento em ms (request total time) */
  loadMs?: number;
  /** Time-to-first-byte em ms */
  ttfb?: number;
  /** Duração do segmento em segundos (sn duration) */
  sd?: number;
  /** SN do fragmento */
  sn?: number | string;
  /** Nível/qualidade ativo */
  level?: number;
  /** Bitrate atual (bps) */
  br?: number;
  /** URL ofensiva (truncada) */
  url?: string;
  /** effectiveType da Network Information API */
  net?: string;
  /** rtt da Network Information API */
  rtt?: number;
  /** downlink Mbps */
  dl?: number;
  /** Contadores arbitrários */
  [k: string]: unknown;
};
type LogEntry = {
  t: number;
  tRel: number;
  source: LogSource;
  level: LogLevel;
  label: string;
  details?: string;
  meta?: LogMeta;
};

/** Por onde o manifest do canal foi carregado. */
type LoadMethod = "browser" | "edge" | "unknown";

/**
 * Causa raiz da falha de reprodução, classificada para o painel de
 * diagnóstico. Mantida separada de DiagnosticStatus para mensagem precisa.
 */
type RootCause =
  | "ok"
  | "manifest_empty"
  | "frag_load_error"
  | "codec_incompatible"
  | "bootstrap_timeout"
  | "mixed_content"
  | "cors_blocked"
  | "network_error"
  | "token_error"
  | "stream_error"
  | "url_invalid"
  | "unknown";

const HLS_CONFIG: Partial<Hls["config"]> = {
  lowLatencyMode: true,
  enableWorker: true,
  // Buffer um pouco maior: reduz quedas em IPTV instável sem deixar o live muito atrasado.
  maxBufferLength: 20,
  maxMaxBufferLength: 60,
  maxBufferSize: 60 * 1000 * 1000,
  // Live: hls.js só começa a tocar depois de bufferar liveSyncDurationCount
  // segmentos. Com segmentos de ~6s, 2 = ~12s de wait vs 3 = ~18s. Reduz
  // ~6s no TTFF mantendo estabilidade — liveMaxLatencyDurationCount=10
  // continua dando margem em redes oscilantes.
  liveSyncDurationCount: 2,
  liveMaxLatencyDurationCount: 10,
  // Otimizações de TTFF
  startLevel: 0,                // começa pelo menor bitrate (instantâneo), ABR sobe depois
  startFragPrefetch: true,      // pré-busca o próximo fragmento já no manifest
  backBufferLength: 0,          // não acumula histórico — libera memória pro start
  maxBufferHole: 0.5,           // tolera gaps comuns em listas IPTV
  highBufferWatchdogPeriod: 1,  // reage rápido a stalls
  // IPTV costuma oscilar: retries maiores evitam erro fatal em falhas transitórias.
  manifestLoadingTimeOut: 12_000,
  manifestLoadingMaxRetry: 3,
  manifestLoadingRetryDelay: 800,
  manifestLoadingMaxRetryTimeout: 12_000,
  levelLoadingTimeOut: 12_000,
  levelLoadingMaxRetry: 8,
  levelLoadingRetryDelay: 1_000,
  levelLoadingMaxRetryTimeout: 12_000,
  fragLoadingTimeOut: 20_000,
  fragLoadingMaxRetry: 8,
  fragLoadingRetryDelay: 800,
  fragLoadingMaxRetryTimeout: 12_000,
};

const HEARTBEAT_INTERVAL_MS = 45_000;
const BOOTSTRAP_TIMEOUT_MS = 12_000;
// Aumentado para 20s: o HLS.js leva até ~15s tentando recuperar level/frag
// load errors não-fatais (8 retries com backoff). Se matarmos antes, o usuário
// vê erro mesmo quando o player ainda ia se recuperar sozinho.
const STALL_TIMEOUT_MS = 20_000;
/**
 * Janela curta para detectar bloqueios de IP/hotlink em provedores como
 * `bkpac.cc`: se o manifest carregou mas nenhum byte de vídeo chegou em
 * 4s, ativamos o proxy de bytes pra esse host (cache 30min em
 * `markHostProxyRequired`) sem esperar o bootstrap watchdog de 12s.
 */
const LOADEDDATA_WATCHDOG_MS = 4_000;
const HLS_FATAL_NETWORK_RETRY_LIMIT = 10;
const HLS_FATAL_MEDIA_RETRY_LIMIT = 4;
const HLS_FATAL_RETRY_BASE_DELAY_MS = 1_200;
const HLS_FATAL_RETRY_MAX_DELAY_MS = 10_000;

const STATUS_LABEL: Record<DiagnosticStatus, string> = {
  connecting: "Conectando",
  playback_started: "Reprodução iniciada",
  stall_timeout: "Stall timeout",
  codec_incompatible: "Codec incompatível",
  stream_error: "Erro no stream",
  stream_no_data: "Sem vídeo no canal",
};

const ROOT_CAUSE_LABEL: Record<RootCause, string> = {
  ok: "Reproduzindo",
  manifest_empty: "Manifest vazio / sem segmentos",
  frag_load_error: "Falha ao baixar segmentos (fragLoadError)",
  codec_incompatible: "Codec incompatível (HEVC/4K)",
  bootstrap_timeout: "Timeout no bootstrap (12s)",
  mixed_content: "Mixed content (HTTPS → HTTP bloqueado)",
  cors_blocked: "CORS bloqueado pelo upstream",
  network_error: "Erro de rede",
  token_error: "Falha ao autorizar stream",
  stream_error: "Erro genérico no stream",
  url_invalid: "URL de stream inválida",
  unknown: "Causa desconhecida",
};

const ROOT_CAUSE_HINT: Record<RootCause, string> = {
  ok: "",
  manifest_empty: "O servidor IPTV respondeu, mas o playlist veio vazio. Canal pode estar offline ou bloqueando o IP do edge.",
  frag_load_error: "Manifest carregou mas os segmentos .ts retornam erro. Pode ser geo-bloqueio ou canal fora do ar.",
  codec_incompatible: "Use VLC ou MX Player para esse canal (HEVC não roda no navegador).",
  bootstrap_timeout: "Nenhum dado em 12s. Canal pode estar offline ou muito lento.",
  mixed_content: "App é HTTPS mas o stream é HTTP. Nada a fazer no browser — abra no VLC.",
  cors_blocked: "O upstream rejeitou o fetch do navegador. Fallback edge cobre esse caso.",
  network_error: "Falha de conexão até o servidor. Verifique sua internet.",
  token_error: "Backend não emitiu token. Veja o detalhe abaixo.",
  stream_error: "O servidor abriu mas o stream falhou. Tente outro canal.",
  url_invalid: "URL malformada. Verifique a credencial.",
  unknown: "—",
};

const LOAD_METHOD_LABEL: Record<LoadMethod, string> = {
  browser: "Browser (direto)",
  edge: "Edge (proxy)",
  unknown: "—",
};

const FUNCTIONS_BASE_HOST = (() => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL).host.toLowerCase();
  } catch {
    return "";
  }
})();

function detectLoadMethod(safeSrc: string): LoadMethod {
  try {
    const host = new URL(safeSrc).host.toLowerCase();
    if (FUNCTIONS_BASE_HOST && host === FUNCTIONS_BASE_HOST) return "edge";
    return "browser";
  } catch {
    return "unknown";
  }
}

function extractUpstreamHost(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  try { return new URL(rawUrl).host; } catch { return null; }
}

// Reduzido para 1: o primeiro fragLoadError antes do primeiro frame já
// indica bloqueio de segmento — ativa o proxy do host imediatamente.
const FRAG_LOAD_ERROR_THRESHOLD = 1;

export const Player = forwardRef<HTMLVideoElement, PlayerProps>(function Player({
  src,
  rawUrl,
  containerExt,
  poster,
  title,
  autoPlay = true,
  onClose,
  streamId,
  contentKind,
}, forwardedRef) {
  const { session } = useIptv();
  const videoRef = useRef<HTMLVideoElement>(null);
  useImperativeHandle(forwardedRef, () => videoRef.current as HTMLVideoElement);
  const hlsRef = useRef<Hls | null>(null);
  // mpegts.js — tipado como any para evitar acoplar @types ao bundle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mpegtsRef = useRef<any>(null);
  const mpegtsTriedM3u8Ref = useRef(false);
  const heartbeatRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const fragLoadErrorCountRef = useRef(0);
  // Tracks the current segment delivery mode for this play session.
  // Starts as "redirect"; flips to "stream" once the host is marked.
  const segmentModeRef = useRef<StreamMode>("redirect");
  // Guard so we only auto-restart once per session when activating proxy.
  const proxyAutoRestartedRef = useRef(false);

  // Watchdog timers
  const bootstrapTimeoutRef = useRef<number | null>(null);
  const stallTimeoutRef = useRef<number | null>(null);
  const loadeddataWatchdogRef = useRef<number | null>(null);

  // Diagnostic flags
  const playbackStartedRef = useRef(false);
  const manifestReadyRef = useRef(false);
  const lastReasonRef = useRef<string | null>(null);

  const [error, setError] = useState<PlayerError | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState<number>(() => {
    try {
      const v = parseFloat(localStorage.getItem("player.rate") || "1");
      return Number.isFinite(v) && v > 0 ? v : 1;
    } catch {
      return 1;
    }
  });

  const [status, setStatus] = useState<DiagnosticStatus>("connecting");
  const [lastReason, setLastReason] = useState<string | null>(null);

  // Diagnóstico estendido (painel)
  const [loadMethod, setLoadMethod] = useState<LoadMethod>("unknown");
  const [rootCause, setRootCause] = useState<RootCause>("unknown");
  const [rootCauseDetail, setRootCauseDetail] = useState<string | null>(null);
  const rootCauseLockedRef = useRef(false);
  const upstreamHost = useMemo(() => extractUpstreamHost(rawUrl ?? src), [rawUrl, src]);

  // Motor de reprodução (apenas faz sentido em canais ao vivo).
  const isLive = useMemo(() => isLiveXtreamUrl(rawUrl ?? src ?? null), [rawUrl, src]);
  const [engine, setEngine] = useState<PlaybackEngine>(() => {
    if (!isLive) return "hls";
    return getPreferredEngine(safeHostFromUrl(rawUrl ?? src)) ?? "hls";
  });
  // Re-sincroniza engine quando o canal muda de host.
  useEffect(() => {
    if (!isLive) {
      setEngine("hls");
      return;
    }
    const pref = getPreferredEngine(safeHostFromUrl(rawUrl ?? src)) ?? "hls";
    setEngine(pref);
    // Channel changed → reset the per-session proxy auto-restart guard so the
    // new channel gets its own opportunity to fall back to proxy.
    proxyAutoRestartedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamHost, isLive]);

  // Logs panel — buffered in refs to avoid re-renders when closed
  const logsRef = useRef<LogEntry[]>([]);
  const setupStartRef = useRef(0);
  const firstFrameAtRef = useRef<number | null>(null);
  const manifestParsedAtRef = useRef<number | null>(null);
  const logsPanelOpenRef = useRef(false);
  const [logsPanelOpen, setLogsPanelOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("player.logsPanel.open") === "1"; }
    catch { return false; }
  });
  const [logsVersion, setLogsVersion] = useState(0);
  const logsListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logsPanelOpenRef.current = logsPanelOpen;
    try { localStorage.setItem("player.logsPanel.open", logsPanelOpen ? "1" : "0"); }
    catch { /* noop */ }
  }, [logsPanelOpen]);

  /**
   * Captura um snapshot leve do `<video>` para anexar a logs. Tudo é
   * opcional e protegido contra elementos não montados.
   */
  const captureVideoMeta = (): LogMeta => {
    const v = videoRef.current;
    if (!v) return {};
    let be: number | undefined;
    let bAhead: number | undefined;
    try {
      const buf = v.buffered;
      if (buf.length > 0) {
        be = buf.end(buf.length - 1);
        bAhead = Math.max(0, be - v.currentTime);
      }
    } catch { /* noop */ }
    return {
      ct: Number.isFinite(v.currentTime) ? +v.currentTime.toFixed(2) : undefined,
      be: be !== undefined ? +be.toFixed(2) : undefined,
      bAhead: bAhead !== undefined ? +bAhead.toFixed(2) : undefined,
      rs: v.readyState,
      ns: v.networkState,
      p: v.paused,
    };
  };

  /**
   * Snapshot da Network Information API (Chrome/Edge). Útil pra correlacionar
   * stalls com queda de qualidade da conexão (ex: 4g → 3g).
   */
  const captureNetMeta = (): LogMeta => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (navigator as any).connection;
    if (!c) return {};
    return {
      net: typeof c.effectiveType === "string" ? c.effectiveType : undefined,
      rtt: typeof c.rtt === "number" ? c.rtt : undefined,
      dl: typeof c.downlink === "number" ? c.downlink : undefined,
    };
  };

  const pushLog = (entry: Omit<LogEntry, "t" | "tRel">) => {
    const t = performance.now();
    const tRel = setupStartRef.current ? t - setupStartRef.current : 0;
    // Mescla auto-snapshot de vídeo + meta explícito do chamador (este último vence).
    const autoMeta = captureVideoMeta();
    const meta = { ...autoMeta, ...(entry.meta ?? {}) };
    // Só anexa se houver algo útil
    const finalMeta = Object.keys(meta).length > 0 ? meta : undefined;
    logsRef.current.push({ ...entry, t, tRel, meta: finalMeta });
    if (logsRef.current.length > 200) logsRef.current.shift();
    if (logsPanelOpenRef.current) setLogsVersion((v) => v + 1);
  };

  const copyTarget = rawUrl || src || "";

  const strategy = useMemo<PlaybackStrategy>(() => {
    if (!src) return { mode: "error", reason: "Nenhum stream selecionado" };
    return getPlaybackStrategy(containerExt, rawUrl || src);
  }, [src, rawUrl, containerExt]);

  const updateStatus = (next: DiagnosticStatus, reason?: string | null) => {
    setStatus(next);
    if (reason !== undefined) {
      lastReasonRef.current = reason;
      setLastReason(reason);
    }
    reportStreamEvent("session_heartbeat", {
      url: src ?? undefined,
      meta: { diagnostic_status: next, reason: reason ?? lastReasonRef.current ?? null },
    });
  };

  /**
   * Define a causa raiz definitiva do canal. Bloqueia após o primeiro set
   * para evitar que erros tardios sobrescrevam a classificação real.
   * `ok` sempre é aceita (sucesso supera qualquer falha anterior).
   */
  const autoReportedRef = useRef(false);

  const setRootCauseOnce = (cause: RootCause, detail?: string | null) => {
    if (cause !== "ok" && rootCauseLockedRef.current) return;
    rootCauseLockedRef.current = cause !== "ok";
    setRootCause(cause);
    setRootCauseDetail(detail ?? null);
    pushLog({
      source: "diag",
      level: cause === "ok" ? "info" : "error",
      label: `root_cause:${cause}`,
      details: detail ?? undefined,
    });

    // Marca conteúdo como incompatível localmente + reporta automaticamente
    // ao admin (uma vez por sessão de player).
    if (cause === "codec_incompatible" && !autoReportedRef.current) {
      autoReportedRef.current = true;
      const targetUrl = rawUrl ?? src ?? "";
      const host = hostFromUrl(targetUrl);
      markIncompatible(host, streamId, detail ?? "codec_incompatible");
      reportStreamEvent("user_report", {
        url: targetUrl || undefined,
        meta: {
          category: "codec_incompatible_auto",
          auto: true,
          title: title ?? null,
          stream_id: streamId ?? null,
          content_kind: contentKind ?? null,
          container_ext: containerExt ?? null,
          host,
          root_cause: cause,
          detail: detail ?? null,
          last_reason: lastReasonRef.current ?? null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          reported_at: new Date().toISOString(),
        },
      });
      pushLog({
        source: "diag",
        level: "warn",
        label: "auto_report_sent",
        details: "codec_incompatible reportado ao admin",
      });
    }
  };

  const clearBootstrapTimeout = () => {
    if (bootstrapTimeoutRef.current !== null) {
      window.clearTimeout(bootstrapTimeoutRef.current);
      bootstrapTimeoutRef.current = null;
    }
  };
  const clearStallTimeout = () => {
    if (stallTimeoutRef.current !== null) {
      window.clearTimeout(stallTimeoutRef.current);
      stallTimeoutRef.current = null;
    }
  };
  const clearLoadeddataWatchdog = () => {
    if (loadeddataWatchdogRef.current !== null) {
      window.clearTimeout(loadeddataWatchdogRef.current);
      loadeddataWatchdogRef.current = null;
    }
  };

  const teardown = () => {
    const v = videoRef.current;
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch { /* noop */ }
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.pause?.();
        mpegtsRef.current.unload?.();
        mpegtsRef.current.detachMediaElement?.();
        mpegtsRef.current.destroy?.();
      } catch { /* noop */ }
      mpegtsRef.current = null;
    }
    mpegtsTriedM3u8Ref.current = false;
    if (v) {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch { /* noop */ }
    }
    if (heartbeatRef.current !== null) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    clearBootstrapTimeout();
    clearStallTimeout();
    clearLoadeddataWatchdog();
    playbackStartedRef.current = false;
    manifestReadyRef.current = false;
  };

  // Setup whenever src/strategy/retryNonce changes — debounced 120ms.
  useEffect(() => {
    let cancelled = false;
    let didSetup = false;

    const debounceTimer = window.setTimeout(() => {
      didSetup = true;
      runSetup();
    }, 120);

    const runSetup = () => {
      teardown();
      setError(null);
      setCopied(false);
      setHidden(false);
      retryCountRef.current = 0;
      fragLoadErrorCountRef.current = 0;
      lastReasonRef.current = null;
      setLastReason(null);
      setStatus("connecting");

      // Resolve segment mode from per-host cache. If host was previously marked
      // as proxy_required, we already start in "stream" mode without waiting
      // for failure.
      segmentModeRef.current = getHostProxyMode(rawUrl ?? src);
      pushLog({
        source: "diag",
        level: "info",
        label: "segment_proxy_mode",
        details: segmentModeRef.current,
      });

      // Reset diagnóstico para novo ciclo
      rootCauseLockedRef.current = false;
      autoReportedRef.current = false;
      setRootCause("unknown");
      setRootCauseDetail(null);
      setLoadMethod("unknown");

      // Reset logs for the new setup cycle
      logsRef.current = [];
      firstFrameAtRef.current = null;
      manifestParsedAtRef.current = null;
      setupStartRef.current = performance.now();
      pushLog({
        source: "diag",
        level: "info",
        label: "setup_start",
        details: src ?? undefined,
        meta: {
          ...captureNetMeta(),
          host: extractUpstreamHost(rawUrl ?? src) ?? undefined,
          engine,
          ext: containerExt,
        },
      });
      if (logsPanelOpenRef.current) setLogsVersion((v) => v + 1);

      if (!src) {
        setLoading(false);
        return;
      }

      if (!isValidStreamUrl(src)) {
        setError({
          title: "URL inválida",
          description: "Não foi possível reproduzir este conteúdo (URL malformada).",
          copyUrl: copyTarget,
        });
        setLoading(false);
        updateStatus("stream_error", "URL inválida");
        setRootCauseOnce("url_invalid", "URL malformada");
        return;
      }

      // Motor "Externo" selecionado manualmente: não tenta reproduzir,
      // apenas mostra ações para abrir em VLC / copiar link.
      if (engine === "external" && isLive) {
        setError({
          title: "Reprodução externa selecionada",
          description: "Abra este canal no VLC, MX Player ou outro player externo.",
          copyUrl: copyTarget,
          external: true,
        });
        setLoading(false);
        updateStatus("connecting", "engine=external");
        setRootCauseOnce("ok", "engine=external");
        pushLog({ source: "diag", level: "info", label: "engine_external", details: copyTarget });
        return;
      }

      if (strategy.mode === "external") {
        const ext = normalizeExt(containerExt).toUpperCase() || "?";
        setError({
          title: "Formato não suportado no navegador",
          description: `Este conteúdo usa um container (${ext}) que não é compatível com reprodução web.`,
          copyUrl: copyTarget,
          external: true,
        });
        setLoading(false);
        updateStatus("codec_incompatible", `container ${ext}`);
        setRootCauseOnce("codec_incompatible", `container ${ext}`);
        return;
      }

      if (strategy.mode === "error") {
        setError({
          title: "Não foi possível reproduzir",
          description: strategy.reason,
          copyUrl: copyTarget,
        });
        setLoading(false);
        updateStatus("stream_error", strategy.reason);
        setRootCauseOnce("stream_error", strategy.reason);
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      setLoading(true);

      /**
       * Try activating segment-proxy mode for this host and restart the player.
       * Returns true if the restart was scheduled (caller should bail out of
       * the current error path); false if we are already in stream mode or
       * already restarted once (avoid loops).
       */
      const tryActivateProxyAndRestart = (reason: string): boolean => {
        if (segmentModeRef.current === "stream") return false;
        if (proxyAutoRestartedRef.current) return false;
        const url = rawUrl ?? src;
        if (!markHostProxyRequired(url, reason)) return false;
        proxyAutoRestartedRef.current = true;
        pushLog({
          source: "diag",
          level: "warn",
          label: "proxy_required_activated",
          details: reason,
        });
        clearBootstrapTimeout();
        clearStallTimeout();
        clearLoadeddataWatchdog();
        setError(null);
        setLoading(true);
        updateStatus("connecting", `proxy auto: ${reason}`);
        // Trigger the setup effect again — segmentModeRef is read fresh from
        // localStorage inside runSetup.
        setRetryNonce((n) => n + 1);
        return true;
      };

      // Helper: finalize as "stream sem dados" (single classification path).
      const finalizeStreamNoData = (reason: string) => {
        if (cancelled) return;
        if (playbackStartedRef.current) return;
        // First: try to recover by activating segment proxy automatically.
        if (tryActivateProxyAndRestart(reason)) return;

        setLoading(false);
        updateStatus("stream_no_data", reason);
        pushLog({ source: "diag", level: "error", label: "stream_no_data", details: reason });
        // Classifica a causa raiz: fragLoadError vs manifest vazio.
        if (/fragLoadError/i.test(reason)) {
          setRootCauseOnce("frag_load_error", reason);
        } else {
          setRootCauseOnce("manifest_empty", reason);
        }
        setError({
          title: "Sem vídeo no canal",
          description:
            "Este canal abriu, mas não está transmitindo vídeo no momento. Tente outro canal ou volte mais tarde.",
          copyUrl: copyTarget,
          noData: true,
        });
        clearBootstrapTimeout();
        clearStallTimeout();
        clearLoadeddataWatchdog();
        let evHost: string | null = null;
        try { if (src) evHost = new URL(src).host; } catch { /* noop */ }
        reportStreamEvent("stream_error", {
          url: src,
          meta: { type: "stream_no_data", reason, host: evHost, mode: segmentModeRef.current },
        });
      };

      // Loadeddata watchdog (6s): se o manifest carregou mas nenhum frame
      // chegou, é assinatura típica de bloqueio de IP/hotlink no upstream.
      // Ativa o proxy de bytes pra esse host antes do bootstrap de 12s — só
      // quando ainda estamos em modo redirect e nunca tentamos restart.
      loadeddataWatchdogRef.current = window.setTimeout(() => {
        if (cancelled) return;
        if (playbackStartedRef.current) return;
        if (segmentModeRef.current === "stream") return;
        if (proxyAutoRestartedRef.current) return;
        // Só age se o manifest realmente chegou — evita falso positivo em
        // conexão lenta onde nem o manifest entrou ainda (esse caso é do
        // bootstrap watchdog).
        if (!manifestReadyRef.current) return;
        tryActivateProxyAndRestart("no_loadeddata_6s");
      }, LOADEDDATA_WATCHDOG_MS);

      // Bootstrap watchdog: must reach `playing`/`loadeddata` within 12s.
      bootstrapTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        if (playbackStartedRef.current) return;

        // C7 fix — manifest pronto mas sem frames: ALWAYS classifica como
        // stream_no_data (não há cenário plausível em que manifest carrega,
        // 12s passam, e ainda assim seja só "stall"). Sem flicker.
        if (manifestReadyRef.current) {
          const reason =
            fragLoadErrorCountRef.current > 0
              ? "fragLoadError + no frames"
              : "manifest carregado, mas sem frames";
          finalizeStreamNoData(reason);
          return;
        }

        // Manifest NUNCA chegou em 12s → falha real de bootstrap.
        const reason = lastReasonRef.current || "sem reprodução após 12s";
        setLoading(false);
        updateStatus("stall_timeout", reason);
        pushLog({ source: "diag", level: "warn", label: "bootstrap_timeout_12s", details: reason });
        setRootCauseOnce("bootstrap_timeout", reason);
        setError({
          title: "Canal não respondeu",
          description:
            "O stream não começou a reproduzir em 12s. Pode ser 4K/HEVC incompatível ou o canal está offline. Copie o link e abra no VLC.",
          copyUrl: copyTarget,
          external: true,
        });
        reportStreamEvent("stream_error", {
          url: src,
          meta: { reason: "bootstrap_timeout_12s", lastReason: reason },
        });
      }, BOOTSTRAP_TIMEOUT_MS);

      const start = async () => {
        try {
          const kind = strategy.type === "hls" ? "playlist" : "segment";
          const tokenStart = performance.now();
          pushLog({ source: "net", level: "info", label: "token_request", details: kind });
          const tokenResp = await requestStreamToken({
            url: src,
            kind,
            iptvUsername: session?.creds.username,
            mode: segmentModeRef.current,
          });
          if (cancelled) return;
          const tokenMs = Math.round(performance.now() - tokenStart);
          const safeSrc = tokenResp.url;
          const method = detectLoadMethod(safeSrc);
          setLoadMethod(method);
          pushLog({
            source: "net",
            level: tokenMs > 1500 ? "warn" : "info",
            label: "token_ok",
            details: `${kind} via ${method} mode=${segmentModeRef.current} (${tokenMs}ms)`,
            meta: { tokenMs, kind, method, mode: segmentModeRef.current },
          });
          console.log("[player] manifest_method:", method, { kind, host: extractUpstreamHost(src), mode: segmentModeRef.current, tokenMs });

          // Heartbeat (renew session lifecycle on backend every 45s)
          heartbeatRef.current = window.setInterval(() => {
            reportStreamEvent("session_heartbeat");
          }, HEARTBEAT_INTERVAL_MS);

          // Motor MPEG-TS para canais ao vivo Xtream.
          // Tenta primeiro a URL .ts; se falhar (sem frames em 8s ou erro fatal),
          // recria automaticamente sobre a URL .m3u8 original ainda no mpegts.js.
          if (engine === "mpegts" && strategy.type === "hls" && isLiveXtreamUrl(safeSrc)) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const mpegtsMod: any = await import("mpegts.js");
              if (cancelled) return;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const mpegts: any = mpegtsMod.default ?? mpegtsMod;
              if (!mpegts.isSupported?.()) {
                pushLog({ source: "diag", level: "warn", label: "mpegts_unsupported", details: "fallback HLS" });
                // Cai para o branch HLS abaixo (não retorna).
              } else {
                const tsUrl = toMpegtsTsUrl(safeSrc) ?? safeSrc;

                const buildPlayer = (url: string, type: "mpegts" | "mse") => {
                  const player = mpegts.createPlayer(
                    { type, url, isLive: true, cors: true },
                    { enableWorker: false, lazyLoad: false, liveBufferLatencyChasing: true },
                  );
                  mpegtsRef.current = player;
                  player.attachMediaElement(video);
                  player.load();
                  // O play é disparado pelo evento `loadeddata` no listener de vídeo.
                  if (autoPlay) {
                    try { player.play(); } catch { /* noop */ }
                  }
                  pushLog({
                    source: "diag",
                    level: "info",
                    label: "mpegts_create",
                    details: `${type} ${url}`,
                  });

                  player.on(mpegts.Events.ERROR, (errType: string, detail: string, info: unknown) => {
                    const msg = `${errType}/${detail}`;
                    lastReasonRef.current = msg;
                    setLastReason(msg);
                    pushLog({
                      source: "diag",
                      level: "error",
                      label: "mpegts_error",
                      details: `${msg} ${info ? JSON.stringify(info) : ""}`,
                    });

                    // Fallback automático .ts → .m3u8 enquanto não tocou ainda.
                    if (
                      !playbackStartedRef.current &&
                      !mpegtsTriedM3u8Ref.current &&
                      type === "mpegts"
                    ) {
                      mpegtsTriedM3u8Ref.current = true;
                      pushLog({ source: "diag", level: "warn", label: "mpegts_fallback_m3u8" });
                      try {
                        player.pause();
                        player.unload();
                        player.detachMediaElement();
                        player.destroy();
                      } catch { /* noop */ }
                      mpegtsRef.current = null;
                      // Recria com a URL .m3u8 original (mpegts.js suporta type "mse" para HLS).
                      buildPlayer(safeSrc, "mse");
                      return;
                    }

                    // Falha definitiva neste motor.
                    setLoading(false);
                    updateStatus("stream_error", msg);
                    setRootCauseOnce("stream_error", msg);
                    setError({
                      title: "MPEG-TS falhou",
                      description: "Tente o motor HLS ou abra no VLC.",
                      copyUrl: copyTarget,
                    });
                    clearBootstrapTimeout();
                    clearStallTimeout();
                  });

                  // O loadeddata/playing nativos cuidam do "primeiro frame".
                };

                buildPlayer(tsUrl, "mpegts");

                // Watchdog dedicado de 8s para o motor MPEG-TS.
                clearBootstrapTimeout();
                bootstrapTimeoutRef.current = window.setTimeout(() => {
                  if (cancelled) return;
                  if (playbackStartedRef.current) return;
                  // Se ainda não tentou m3u8 e watchdog estourou, faz o fallback.
                  if (!mpegtsTriedM3u8Ref.current && mpegtsRef.current) {
                    mpegtsTriedM3u8Ref.current = true;
                    pushLog({ source: "diag", level: "warn", label: "mpegts_watchdog_fallback_m3u8" });
                    try {
                      mpegtsRef.current.pause();
                      mpegtsRef.current.unload();
                      mpegtsRef.current.detachMediaElement();
                      mpegtsRef.current.destroy();
                    } catch { /* noop */ }
                    mpegtsRef.current = null;
                    buildPlayer(safeSrc, "mse");
                    // Re-arma o watchdog para a 2ª tentativa.
                    bootstrapTimeoutRef.current = window.setTimeout(() => {
                      if (cancelled || playbackStartedRef.current) return;
                      setLoading(false);
                      updateStatus("stream_error", "mpegts sem frames em 8s");
                      setRootCauseOnce("bootstrap_timeout", "mpegts sem frames em 8s");
                      setError({
                        title: "MPEG-TS sem resposta",
                        description: "Tente o motor HLS ou abra no VLC.",
                        copyUrl: copyTarget,
                      });
                    }, MPEGTS_BOOTSTRAP_TIMEOUT_MS);
                    return;
                  }
                  // Watchdog estourou na 2ª tentativa também.
                  setLoading(false);
                  updateStatus("stream_error", "mpegts sem frames em 8s");
                  setRootCauseOnce("bootstrap_timeout", "mpegts sem frames em 8s");
                  setError({
                    title: "MPEG-TS sem resposta",
                    description: "Tente o motor HLS ou abra no VLC.",
                    copyUrl: copyTarget,
                  });
                }, MPEGTS_BOOTSTRAP_TIMEOUT_MS);

                return;
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : "import mpegts.js falhou";
              pushLog({ source: "diag", level: "error", label: "mpegts_import_error", details: msg });
              // Cai para HLS abaixo.
            }
          }

          if (strategy.type === "hls") {
            if (Hls.isSupported()) {
              // Em modo proxy (stream), latência por segmento é maior.
              // Aumenta buffer alvo e tolerância a gaps para evitar stalls.
              const hlsConfig: Partial<Hls["config"]> =
                segmentModeRef.current === "stream"
                  ? {
                      ...HLS_CONFIG,
                      maxBufferLength: 30,
                      maxMaxBufferLength: 90,
                      liveSyncDurationCount: 4,
                      liveMaxLatencyDurationCount: 12,
                      maxBufferHole: 0.8,
                      levelLoadingMaxRetry: 10,
                      fragLoadingMaxRetry: 10,
                    }
                  : HLS_CONFIG;
              const hls = new Hls(hlsConfig);
              hlsRef.current = hls;

              // Safe bootstrap: attach FIRST, then load source after attached.
              hls.attachMedia(video);

              hls.once(Hls.Events.MEDIA_ATTACHED, () => {
                if (cancelled) return;
                pushLog({ source: "hls", level: "info", label: "media_attached" });
                // Play antecipado: dispara `play()` antes do manifest parsear.
                // O navegador aguarda dados sem custo extra e renderiza o
                // primeiro frame assim que o segmento chega.
                if (autoPlay) video.play().catch(() => {});
                try { hls.loadSource(safeSrc); } catch (e) {
                  const msg = `loadSource falhou: ${(e as Error).message}`;
                  lastReasonRef.current = msg;
                  setLastReason(msg);
                  pushLog({ source: "hls", level: "error", label: "loadSource_error", details: msg });
                }
              });

              hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
                if (cancelled) return;
                manifestReadyRef.current = true;
                manifestParsedAtRef.current = performance.now();
                lastReasonRef.current = "manifest carregado";
                setLastReason("manifest carregado");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const levels = (data as any)?.levels?.length ?? 0;
                pushLog({
                  source: "hls",
                  level: "info",
                  label: "manifest_parsed",
                  details: `levels=${levels}`,
                  meta: { ...captureNetMeta(), levels },
                });
              });

              hls.on(Hls.Events.LEVEL_LOADED, (_evt, data) => {
                if (cancelled) return;
                if (retryCountRef.current > 0) retryCountRef.current = 0;
                // Sucesso de rede: cancela o watchdog de stall (HLS está vivo).
                clearStallTimeout();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const d = data as any;
                const lvl = typeof d?.level === "number" ? d.level : undefined;
                const stats = d?.stats ?? {};
                const ttfb = stats.tfirst && stats.trequest ? Math.round(stats.tfirst - stats.trequest) : undefined;
                const loadMs = stats.tload && stats.trequest ? Math.round(stats.tload - stats.trequest) : undefined;
                const fragCount = d?.details?.fragments?.length;
                pushLog({
                  source: "hls",
                  level: "info",
                  label: "level_loaded",
                  details: `lvl=${lvl} frags=${fragCount ?? "?"} ttfb=${ttfb ?? "?"}ms`,
                  meta: { level: lvl, ttfb, loadMs, frags: fragCount },
                });
              });

              hls.on(Hls.Events.FRAG_LOADED, (_evt, data) => {
                if (cancelled) return;
                if (fragLoadErrorCountRef.current > 0) fragLoadErrorCountRef.current = 0;
                // Fragmento chegou: cancela o watchdog de stall.
                clearStallTimeout();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const d = data as any;
                const frag = d?.frag ?? {};
                const stats = d?.payload ? { total: d.payload.byteLength } : (frag.stats ?? {});
                const ttfb = stats.tfirst && stats.trequest ? Math.round(stats.tfirst - stats.trequest) : undefined;
                const loadMs = stats.tload && stats.trequest ? Math.round(stats.tload - stats.trequest) : undefined;
                const bytes = stats.total ?? stats.loaded;
                pushLog({
                  source: "hls",
                  level: "info",
                  label: "frag_loaded",
                  details: `sn=${frag.sn} ${bytes ? `${Math.round(bytes / 1024)}KB` : ""} ${loadMs ?? "?"}ms`,
                  meta: {
                    sn: frag.sn,
                    sd: frag.duration,
                    bytes,
                    ttfb,
                    loadMs,
                    level: frag.level,
                  },
                });
              });

              hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
                if (cancelled) return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const d = data as any;
                const lvl = d?.level;
                const br = hls.levels?.[lvl]?.bitrate;
                pushLog({
                  source: "hls",
                  level: "info",
                  label: "level_switched",
                  details: `lvl=${lvl} ${br ? `${Math.round(br / 1000)}kbps` : ""}`,
                  meta: { level: lvl, br },
                });
              });

              hls.on(Hls.Events.FRAG_LOAD_EMERGENCY_ABORTED, (_evt, data) => {
                if (cancelled) return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const frag = (data as any)?.frag ?? {};
                pushLog({
                  source: "hls",
                  level: "warn",
                  label: "frag_emergency_aborted",
                  details: `sn=${frag.sn} — bitrate baixou`,
                  meta: { sn: frag.sn, level: frag.level },
                });
              });

              hls.on(Hls.Events.ERROR, (_evt, data: ErrorData) => {
                const detail = `${data.type}/${data.details}`;
                lastReasonRef.current = detail;
                setLastReason(detail);
                // Extrai info HTTP/URL pra diagnóstico
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const d = data as any;
                const ctx = d?.context ?? d?.networkDetails ?? {};
                const httpStatus =
                  typeof d?.response?.code === "number" ? d.response.code :
                  typeof ctx?.status === "number" ? ctx.status :
                  undefined;
                const offendingUrl: string | undefined =
                  d?.frag?.url ?? d?.url ?? ctx?.responseURL ?? d?.context?.url;
                const truncatedUrl = offendingUrl
                  ? offendingUrl.length > 120 ? `${offendingUrl.slice(0, 60)}…${offendingUrl.slice(-50)}` : offendingUrl
                  : undefined;
                pushLog({
                  source: "hls",
                  level: data.fatal ? "error" : "warn",
                  label: "error",
                  details: `${detail} fatal=${data.fatal}${httpStatus ? ` http=${httpStatus}` : ""}`,
                  meta: {
                    http: httpStatus,
                    url: truncatedUrl,
                    sn: d?.frag?.sn,
                    level: d?.frag?.level ?? d?.level,
                    bytes: d?.frag?.stats?.loaded,
                    ...captureNetMeta(),
                  },
                });

                // Codec / decode → mark immediately
                if (
                  data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR ||
                  data.details === Hls.ErrorDetails.BUFFER_INCOMPATIBLE_CODECS_ERROR
                ) {
                  if (data.fatal) {
                    setLoading(false);
                    updateStatus("codec_incompatible", detail);
                    setRootCauseOnce("codec_incompatible", detail);
                    setError({
                      title: "Codec incompatível",
                      description: "O canal usa codec não suportado pelo navegador (provavelmente HEVC/4K). Abra no VLC.",
                      copyUrl: copyTarget,
                      external: true,
                    });
                    clearBootstrapTimeout();
                    clearStallTimeout();
                  }
                  return;
                }

                // Track repeated frag-load errors when manifest is ready but
                // playback never started — classify as "stream sem dados".
                if (
                  data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
                  data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT ||
                  data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR
                ) {
                  fragLoadErrorCountRef.current += 1;
                  pushLog({
                    source: "diag",
                    level: "warn",
                    label: "frag_load_error_count",
                    details: `${fragLoadErrorCountRef.current}/${FRAG_LOAD_ERROR_THRESHOLD}`,
                  });
                  if (
                    !playbackStartedRef.current &&
                    manifestReadyRef.current &&
                    fragLoadErrorCountRef.current >= FRAG_LOAD_ERROR_THRESHOLD
                  ) {
                    const reason = "fragLoadError + no frames";
                    try { hls.stopLoad(); } catch { /* noop */ }
                    // Auto-activate segment proxy if not yet tried.
                    if (tryActivateProxyAndRestart(reason)) return;

                    setLoading(false);
                    updateStatus("stream_no_data", reason);
                    pushLog({ source: "diag", level: "error", label: "stream_no_data", details: reason });
                    setError({
                      title: "Sem vídeo no canal",
                      description:
                        "Este canal abriu, mas não está transmitindo vídeo no momento. Tente outro canal ou volte mais tarde.",
                      copyUrl: copyTarget,
                      noData: true,
                    });
                    clearBootstrapTimeout();
                    clearStallTimeout();
                    let upstreamHost: string | null = null;
                    try { if (src) upstreamHost = new URL(src).host; } catch { /* noop */ }
                    reportStreamEvent("stream_error", {
                      url: src,
                      meta: { type: "stream_no_data", reason, host: upstreamHost, mode: segmentModeRef.current },
                    });
                    return;
                  }
                  // Not yet at threshold — let HLS retry naturally.
                  return;
                }

                if (!data.fatal) return;

                if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCountRef.current < HLS_FATAL_NETWORK_RETRY_LIMIT) {
                  retryCountRef.current += 1;
                  const delay = Math.min(
                    HLS_FATAL_RETRY_MAX_DELAY_MS,
                    HLS_FATAL_RETRY_BASE_DELAY_MS * retryCountRef.current,
                  );
                  pushLog({
                    source: "diag",
                    level: "warn",
                    label: "hls_network_recover",
                    details: `${retryCountRef.current}/${HLS_FATAL_NETWORK_RETRY_LIMIT} in ${delay}ms`,
                  });
                  setTimeout(() => {
                    try { hls.startLoad(); } catch { /* noop */ }
                  }, delay);
                  return;
                }
                if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryCountRef.current < HLS_FATAL_MEDIA_RETRY_LIMIT) {
                  retryCountRef.current += 1;
                  pushLog({
                    source: "diag",
                    level: "warn",
                    label: "hls_media_recover",
                    details: `${retryCountRef.current}/${HLS_FATAL_MEDIA_RETRY_LIMIT}`,
                  });
                  try { hls.recoverMediaError(); return; } catch { /* fallthrough */ }
                }
                setLoading(false);
                updateStatus("stream_error", detail);
                // Tipo da falha do hls.js → causa raiz
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                  setRootCauseOnce("network_error", detail);
                } else {
                  setRootCauseOnce("stream_error", detail);
                }
                setError({
                  title: "Falha ao carregar o stream",
                  description: "O canal pode estar offline ou instável. Tente novamente em alguns segundos.",
                  copyUrl: copyTarget,
                });
                clearBootstrapTimeout();
                clearStallTimeout();
                reportStreamEvent("stream_error", {
                  url: src,
                  meta: { type: data.type, details: data.details },
                });
              });

              return;
            }

            if (video.canPlayType("application/vnd.apple.mpegurl")) {
              video.src = safeSrc;
              reportStreamEvent("stream_started", { url: src, meta: { kind: "hls-native" } });
              if (autoPlay) video.play().catch(() => {});
              return;
            }

            setLoading(false);
            updateStatus("stream_error", "navegador sem suporte HLS");
            setRootCauseOnce("codec_incompatible", "navegador sem suporte HLS");
            setError({
              title: "Navegador incompatível",
              description: "Seu navegador não suporta HLS. Use Chrome, Firefox, Edge ou Safari.",
              copyUrl: copyTarget,
            });
            return;
          }

          // Native (mp4 / webm)
          video.src = safeSrc;
          reportStreamEvent("stream_started", { url: src, meta: { kind: "native" } });
          if (autoPlay) video.play().catch(() => {});
        } catch (err) {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          setLoading(false);
          const blocked = /blocked|bloque/i.test(msg);
          const ratelimit = /Too many|429/i.test(msg);
          updateStatus("stream_error", msg);
          pushLog({ source: "net", level: "error", label: "token_error", details: msg });
          setRootCauseOnce("token_error", msg);
          setError({
            title: blocked
              ? "Acesso temporariamente bloqueado"
              : ratelimit
                ? "Limite de uso atingido"
                : "Não foi possível autorizar o stream",
            description: blocked
              ? "Detectamos atividade incomum. Tente novamente em alguns minutos."
              : ratelimit
                ? "Aguarde 1 minuto antes de tentar novamente."
                : msg,
            copyUrl: copyTarget,
          });
          clearBootstrapTimeout();
        }
      };

      start();
    };

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      if (!didSetup) {
        reportStreamEvent("stream_error", {
          url: src ?? undefined,
          meta: { reason: "player_switch_debounced" },
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, strategy, containerExt, autoPlay, copyTarget, retryNonce, engine]);

  // Native <video> listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onWaiting = () => {
      pushLog({ source: "video", level: "warn", label: "waiting" });
      if (!playbackStartedRef.current) {
        setLoading(true);
        return;
      }
      // Mid-stream stall: arm the stall timeout
      if (stallTimeoutRef.current === null) {
        stallTimeoutRef.current = window.setTimeout(() => {
          updateStatus("stall_timeout", lastReasonRef.current || "BUFFER_STALLED_ERROR");
          pushLog({
            source: "diag",
            level: "error",
            label: "stall_timeout",
            details: `${Math.round(STALL_TIMEOUT_MS / 1000)}s — ${lastReasonRef.current ?? "no reason"}`,
            meta: {
              ...captureNetMeta(),
              fragErrors: fragLoadErrorCountRef.current,
              fatalRetries: retryCountRef.current,
            },
          });
        }, STALL_TIMEOUT_MS);
      }
    };
    const onStalled = () => {
      lastReasonRef.current = "BUFFER_STALLED_ERROR";
      setLastReason("BUFFER_STALLED_ERROR");
      pushLog({ source: "video", level: "warn", label: "stalled" });
      if (!playbackStartedRef.current) {
        setLoading(true);
        return;
      }
      if (stallTimeoutRef.current === null) {
        stallTimeoutRef.current = window.setTimeout(() => {
          updateStatus("stall_timeout", "BUFFER_STALLED_ERROR");
          pushLog({
            source: "diag",
            level: "error",
            label: "stall_timeout",
            details: `${Math.round(STALL_TIMEOUT_MS / 1000)}s — BUFFER_STALLED_ERROR`,
            meta: {
              ...captureNetMeta(),
              fragErrors: fragLoadErrorCountRef.current,
              fatalRetries: retryCountRef.current,
            },
          });
        }, STALL_TIMEOUT_MS);
      }
    };
    const onPlaying = () => {
      const wasFirst = !playbackStartedRef.current;
      playbackStartedRef.current = true;
      setLoading(false);
      clearBootstrapTimeout();
      clearStallTimeout();
      clearLoadeddataWatchdog();
      if (wasFirst) {
        firstFrameAtRef.current = performance.now();
        const ttff = setupStartRef.current ? Math.round(firstFrameAtRef.current - setupStartRef.current) : 0;
        pushLog({ source: "video", level: "info", label: "first_playing", details: `TTFF=${ttff}ms` });
        updateStatus("playback_started", null);
        setRootCauseOnce("ok", `TTFF=${ttff}ms`);
        reportStreamEvent("stream_started", { url: src ?? undefined, meta: { trigger: "playing_event", ttff_ms: ttff } });
      } else if (status === "stall_timeout") {
        updateStatus("playback_started", "recuperado após stall");
        pushLog({ source: "diag", level: "info", label: "recovered_after_stall" });
      }
    };
    const onCanPlay = () => setLoading(false);
    const onLoadedData = () => {
      const wasFirst = !playbackStartedRef.current;
      playbackStartedRef.current = true;
      setLoading(false);
      clearBootstrapTimeout();
      clearStallTimeout();
      clearLoadeddataWatchdog();
      const ttff = setupStartRef.current
        ? Math.round(performance.now() - setupStartRef.current)
        : 0;
      pushLog({ source: "video", level: "info", label: "loadeddata", details: `TTFF=${ttff}ms` });
      if (wasFirst) {
        if (firstFrameAtRef.current === null) {
          firstFrameAtRef.current = performance.now();
        }
        updateStatus("playback_started", null);
      }
    };
    const onError = () => {
      const code = video.error?.code;
      const msg = video.error?.message;
      const isCodec = code === 4 || code === 3;
      const reason = `MEDIA_ERR_${code ?? "?"}${msg ? `: ${msg}` : ""}`;
      lastReasonRef.current = reason;
      setLastReason(reason);
      pushLog({ source: "video", level: "error", label: "error", details: reason });
      updateStatus(isCodec ? "codec_incompatible" : "stream_error", reason);
      setRootCauseOnce(isCodec ? "codec_incompatible" : "stream_error", reason);
      setError({
        title: isCodec ? "Codec incompatível" : "Não foi possível reproduzir",
        description: isCodec
          ? "Este canal usa um codec (provavelmente HEVC/4K) que o navegador não decodifica. Abra no VLC para assistir."
          : "Este conteúdo pode estar offline, em formato incompatível ou bloqueado pelo servidor.",
        copyUrl: copyTarget,
        external: isCodec,
      });
      setLoading(false);
      clearBootstrapTimeout();
      clearStallTimeout();
    };

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyTarget, src]);

  useEffect(() => () => teardown(), []);

  const handleCopy = async () => {
    const target = error?.copyUrl || copyTarget;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      toast.success("Link copiado — abra no VLC ou MX Player");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const handleOpenExternal = () => {
    const target = error?.copyUrl || copyTarget;
    if (!target) return;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const handleRetry = () => {
    if (!src) return;
    pushLog({ source: "diag", level: "info", label: "retry" });
    setError(null);
    retryCountRef.current = 0;
    setLoading(true);
    setRetryNonce((n) => n + 1);
  };

  const handleEngineChange = (next: PlaybackEngine) => {
    if (next === engine) return;
    setPreferredEngine(safeHostFromUrl(rawUrl ?? src), next);
    pushLog({ source: "diag", level: "info", label: "engine_change", details: `${engine} → ${next}` });
    console.log("[player] engine_change:", engine, "→", next);
    setError(null);
    setLoading(true);
    setEngine(next);
  };

  // ===== Playback rate + skip controls =====
  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(rate);
    try {
      localStorage.setItem("player.rate", String(rate));
    } catch {
      /* noop */
    }
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  // Aplica rate sempre que o vídeo (re)cria.
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, src, retryNonce]);

  const skipBy = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (isLive) return; // não tem efeito em live
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    const target = Math.max(0, Math.min(dur > 0 ? dur - 1 : v.currentTime + delta, v.currentTime + delta));
    v.currentTime = target;
  };

  // Atalhos de teclado: ← → ±10s, Espaço play/pause, > < velocidade
  useEffect(() => {
    if (!src || error) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      switch (e.key) {
        case "ArrowLeft":
          if (!isLive) {
            e.preventDefault();
            skipBy(-10);
          }
          break;
        case "ArrowRight":
          if (!isLive) {
            e.preventDefault();
            skipBy(10);
          }
          break;
        case " ": {
          const v = videoRef.current;
          if (v) {
            e.preventDefault();
            if (v.paused) v.play().catch(() => {});
            else v.pause();
          }
          break;
        }
        case ">":
        case ".":
          setPlaybackRate(Math.min(2, +(playbackRate + 0.25).toFixed(2)));
          break;
        case "<":
        case ",":
          setPlaybackRate(Math.max(0.5, +(playbackRate - 0.25).toFixed(2)));
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, error, isLive, playbackRate]);

  const reportSnapshot: ReportSnapshot = {
    title,
    url: copyTarget,
    containerExt,
    engine: ENGINE_LABEL[engine],
    loadMethod: LOAD_METHOD_LABEL[loadMethod],
    rootCause: ROOT_CAUSE_LABEL[rootCause],
    lastReason,
    upstreamHost,
    status: STATUS_LABEL[status],
  };

  // Auto-scroll the logs list to the bottom when new logs arrive
  useEffect(() => {
    if (!logsPanelOpen) return;
    const el = logsListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logsVersion, logsPanelOpen]);

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(logsRef.current, null, 2));
      toast.success("Logs copiados");
    } catch {
      toast.error("Não foi possível copiar os logs");
    }
  };
  const handleClearLogs = () => {
    logsRef.current = [];
    setLogsVersion((v) => v + 1);
  };

  const fmtMs = (ms: number | null) =>
    ms === null || !Number.isFinite(ms) ? "—" : `${Math.round(ms)} ms`;
  const setupToManifest =
    manifestParsedAtRef.current && setupStartRef.current
      ? manifestParsedAtRef.current - setupStartRef.current
      : null;
  const setupToFirstFrame =
    firstFrameAtRef.current && setupStartRef.current
      ? firstFrameAtRef.current - setupStartRef.current
      : null;
  const manifestToFirstFrame =
    firstFrameAtRef.current && manifestParsedAtRef.current
      ? firstFrameAtRef.current - manifestParsedAtRef.current
      : null;

  const sourceBadge: Record<LogSource, string> = {
    hls: "bg-blue-500/20 text-blue-200 border-blue-500/40",
    video: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
    diag: "bg-amber-500/20 text-amber-200 border-amber-500/40",
    net: "bg-purple-500/20 text-purple-200 border-purple-500/40",
  };
  const levelTone: Record<LogLevel, string> = {
    info: "text-foreground",
    warn: "text-yellow-300",
    error: "text-red-400",
  };

  const handleClose = () => {
    teardown();
    if (onClose) onClose();
    else setHidden(true);
  };

  if (!src || hidden) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-card flex items-center justify-center shadow-card">
        <div className="absolute inset-0 bg-gradient-glow opacity-50" />
        <div className="relative z-10 text-center p-8">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Tv className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            {hidden ? "Reprodução encerrada" : "Selecione um canal"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {hidden ? "Escolha outro conteúdo para continuar" : "Escolha um canal, filme ou série para começar a assistir"}
          </p>
        </div>
      </div>
    );
  }

  const showVideo =
    strategy.mode === "internal" && (!error || (!error.external && !error.noData));

  // Diagnostic card colors via semantic tokens
  const statusTone: Record<DiagnosticStatus, string> = {
    connecting: "border-border bg-background/80 text-muted-foreground",
    playback_started: "border-primary/40 bg-primary/15 text-primary-foreground",
    stall_timeout: "border-yellow-500/50 bg-yellow-500/15 text-yellow-100",
    codec_incompatible: "border-destructive/50 bg-destructive/15 text-destructive-foreground",
    stream_error: "border-destructive/50 bg-destructive/15 text-destructive-foreground",
    stream_no_data: "border-yellow-500/50 bg-yellow-500/15 text-yellow-100",
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-card animate-scale-in">
      {showVideo && (
        <video
          ref={videoRef}
          className="h-full w-full"
          controls
          playsInline
          poster={poster}
        />
      )}

      {title && !error && (
        <div className="pointer-events-none absolute left-0 top-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4">
          <h3 className="text-sm font-semibold text-white drop-shadow pr-32">{title}</h3>
        </div>
      )}

      {/* Custom controls bar — top-right (skip ±10s, speed, report) */}
      {showVideo && !error && (
        <div className="pointer-events-auto absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {!isLive && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 bg-black/60 hover:bg-black/80 backdrop-blur border-0 text-white"
                onClick={() => skipBy(-10)}
                title="Voltar 10 segundos (←)"
                aria-label="Voltar 10 segundos"
              >
                <Rewind className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 bg-black/60 hover:bg-black/80 backdrop-blur border-0 text-white"
                onClick={() => skipBy(10)}
                title="Avançar 10 segundos (→)"
                aria-label="Avançar 10 segundos"
              >
                <FastForward className="h-4 w-4" />
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-9 px-2.5 bg-black/60 hover:bg-black/80 backdrop-blur border-0 text-white gap-1.5 tabular-nums"
                title="Velocidade de reprodução"
              >
                <Gauge className="h-3.5 w-3.5" />
                {playbackRate}x
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[120px]">
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                <DropdownMenuItem
                  key={r}
                  onClick={() => setPlaybackRate(r)}
                  className={cn(
                    "justify-between tabular-nums",
                    r === playbackRate && "bg-primary/10 text-primary font-medium",
                  )}
                >
                  {r}x
                  {r === 1 && <span className="text-[10px] text-muted-foreground">normal</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 bg-black/60 hover:bg-destructive/80 backdrop-blur border-0 text-white"
            onClick={() => setReportOpen(true)}
            title="Reportar problema"
            aria-label="Reportar problema"
          >
            <Flag className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="secondary"
              size="icon"
              className="h-9 w-9 bg-black/60 hover:bg-black/80 backdrop-blur border-0 text-white"
              onClick={onClose}
              title="Fechar (Esc)"
              aria-label="Fechar player"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Diagnostic card — small, non-blocking, bottom-right */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-3 right-3 z-20 max-w-[260px] rounded-md border px-2.5 py-1.5 backdrop-blur-md shadow-lg text-[11px] leading-tight",
          statusTone[status],
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-1.5 font-semibold">
          <Activity className="h-3 w-3" />
          <span>{STATUS_LABEL[status]}</span>
        </div>
        {lastReason && (
          <div className="mt-0.5 truncate opacity-80" title={lastReason}>
            {lastReason}
          </div>
        )}
      </div>

      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-xs text-white/80">Conectando…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm p-6">
          <div className="max-w-md text-center space-y-4">
            <div
              className={cn(
                "mx-auto h-14 w-14 rounded-full flex items-center justify-center",
                error.noData ? "bg-yellow-500/15" : "bg-destructive/15",
              )}
            >
              {error.noData ? (
                <VideoOff className="h-7 w-7 text-yellow-400" />
              ) : (
                <AlertTriangle className="h-7 w-7 text-destructive" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {error.title || "Não foi possível reproduzir"}
              </h3>
              {error.description && (
                <p className="mt-1 text-sm text-muted-foreground">{error.description}</p>
              )}
              {!error.noData && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Copie o link e abra no VLC, MX Player ou outro player externo.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {error.noData ? (
                <>
                  <Button onClick={handleRetry} variant="default" size="sm" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Tentar novamente
                  </Button>
                  <Button onClick={handleClose} variant="secondary" size="sm" className="gap-2">
                    <ListVideo className="h-4 w-4" />
                    Trocar canal
                  </Button>
                </>
              ) : error.external ? (
                <>
                  <Button onClick={handleOpenExternal} variant="default" size="sm" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Abrir em player externo
                  </Button>
                  <Button onClick={handleCopy} variant="secondary" size="sm" className="gap-2">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar link"}
                  </Button>
                  <Button onClick={handleRetry} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Tentar novamente
                  </Button>
                  <Button onClick={handleClose} variant="outline" size="sm" className="gap-2">
                    <X className="h-4 w-4" />
                    Fechar
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleRetry} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Tentar novamente
                  </Button>
                  <Button onClick={handleCopy} variant="secondary" size="sm" className="gap-2">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar link"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logs panel toggle — bottom-left */}
      <button
        type="button"
        onClick={() => setLogsPanelOpen((o) => !o)}
        className={cn(
          "pointer-events-auto absolute bottom-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium backdrop-blur-md shadow-sm transition-colors",
          logsPanelOpen
            ? "border-primary/50 bg-primary/20 text-primary-foreground"
            : "border-border bg-background/80 text-muted-foreground hover:bg-background/95",
        )}
        aria-pressed={logsPanelOpen}
        aria-label="Alternar logs do player"
      >
        <Terminal className="h-3 w-3" />
        Logs
      </button>

      {/* Logs panel — right side overlay */}
      {logsPanelOpen && (
        <div
          className="pointer-events-auto absolute top-3 right-3 bottom-14 z-30 w-[360px] max-w-[calc(100%-1.5rem)] flex flex-col rounded-md border bg-background/95 backdrop-blur-md shadow-xl text-foreground"
          role="dialog"
          aria-label="Logs do player"
        >
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Terminal className="h-3.5 w-3.5" />
              Logs do player
            </div>
            <div className="flex items-center gap-1">
              <Button onClick={handleCopyLogs} variant="ghost" size="icon" className="h-7 w-7" title="Copiar JSON">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button onClick={handleClearLogs} variant="ghost" size="icon" className="h-7 w-7" title="Limpar">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button onClick={() => setLogsPanelOpen(false)} variant="ghost" size="icon" className="h-7 w-7" title="Fechar">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Diagnóstico estruturado: causa raiz + método de carga */}
          <div className="border-b px-3 py-2 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Causa</span>
              <span
                className={cn(
                  "font-semibold rounded px-1.5 py-0.5 border text-[10px] uppercase tracking-wide",
                  rootCause === "ok"
                    ? "bg-primary/15 text-primary border-primary/40"
                    : rootCause === "unknown"
                      ? "bg-muted text-muted-foreground border-border"
                      : "bg-destructive/15 text-destructive border-destructive/40",
                )}
                title={rootCauseDetail ?? undefined}
              >
                {ROOT_CAUSE_LABEL[rootCause]}
              </span>
            </div>
            {rootCause !== "ok" && rootCause !== "unknown" && (
              <p className="text-muted-foreground leading-snug">
                {ROOT_CAUSE_HINT[rootCause]}
              </p>
            )}
            {rootCauseDetail && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Detalhe</span>
                <span className="font-mono text-right break-all" title={rootCauseDetail}>
                  {rootCauseDetail}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Método</span>
              <span
                className={cn(
                  "font-semibold rounded px-1.5 py-0.5 border text-[10px] uppercase tracking-wide",
                  loadMethod === "browser"
                    ? "bg-primary/15 text-primary border-primary/40"
                    : loadMethod === "edge"
                      ? "bg-secondary text-secondary-foreground border-border"
                      : "bg-muted text-muted-foreground border-border",
                )}
              >
                {LOAD_METHOD_LABEL[loadMethod]}
              </span>
            </div>
            {upstreamHost && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Upstream</span>
                <span className="font-mono truncate max-w-[60%] text-right" title={upstreamHost}>
                  {upstreamHost}
                </span>
              </div>
            )}
          </div>

          {/* Seletor de motor — apenas para canais ao vivo Xtream */}
          {isLive && (
            <div className="border-b px-3 py-2 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Motor</span>
                <span className="text-[10px] text-muted-foreground">
                  {ENGINE_LABEL[engine]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(["hls", "mpegts", "external"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleEngineChange(opt)}
                    aria-pressed={engine === opt}
                    className={cn(
                      "rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                      engine === opt
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "bg-background/60 border-border text-muted-foreground hover:bg-background/90",
                    )}
                  >
                    {ENGINE_LABEL[opt]}
                  </button>
                ))}
              </div>
              {engine === "hls" &&
                (rootCause === "frag_load_error" ||
                  rootCause === "manifest_empty" ||
                  rootCause === "codec_incompatible") && (
                  <button
                    type="button"
                    onClick={() => handleEngineChange("mpegts")}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded border border-primary/50 bg-primary/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary hover:bg-primary/25 transition-colors"
                  >
                    <Zap className="h-3 w-3" />
                    Tente MPEG-TS direto
                  </button>
                )}
              {engine === "mpegts" && rootCause !== "ok" && rootCause !== "unknown" && (
                <button
                  type="button"
                  onClick={() => handleEngineChange("external")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded border border-border bg-background/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-background/90 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir externo (VLC)
                </button>
              )}
            </div>
          )}

          <div className="border-b px-3 py-2 text-[11px] grid grid-cols-1 gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Setup → Manifest</span>
              <span className="font-mono">{fmtMs(setupToManifest)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Setup → First Frame (TTFF)</span>
              <span className="font-mono">{fmtMs(setupToFirstFrame)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Manifest → First Frame</span>
              <span className="font-mono">{fmtMs(manifestToFirstFrame)}</span>
            </div>
          </div>

          <div ref={logsListRef} className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1 text-[11px] font-mono">
            {logsRef.current.length === 0 ? (
              <div className="text-muted-foreground text-center py-4">Sem eventos ainda</div>
            ) : (
              logsRef.current.map((entry, i) => {
                // Formata meta numa linha curta humanamente legível.
                // Ex: "ct=12.3 bAhead=2.1 rs=4 http=503"
                const metaParts: string[] = [];
                if (entry.meta) {
                  const m = entry.meta;
                  if (m.ct !== undefined) metaParts.push(`ct=${m.ct}`);
                  if (m.bAhead !== undefined) metaParts.push(`buf=${m.bAhead}s`);
                  if (m.rs !== undefined) metaParts.push(`rs=${m.rs}`);
                  if (m.http !== undefined) metaParts.push(`http=${m.http}`);
                  if (m.bytes !== undefined) metaParts.push(`${Math.round((m.bytes as number) / 1024)}KB`);
                  if (m.ttfb !== undefined) metaParts.push(`ttfb=${m.ttfb}ms`);
                  if (m.loadMs !== undefined) metaParts.push(`load=${m.loadMs}ms`);
                  if (m.net) metaParts.push(`net=${m.net}`);
                  if (m.rtt !== undefined) metaParts.push(`rtt=${m.rtt}`);
                }
                const metaStr = metaParts.join(" ");
                const fullMetaJson = entry.meta ? JSON.stringify(entry.meta, null, 2) : "";
                return (
                  <div key={i} className="flex items-start gap-1.5 leading-tight">
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      [+{Math.round(entry.tRel)}ms]
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded border px-1 py-0 text-[10px] uppercase tracking-wide",
                        sourceBadge[entry.source],
                      )}
                    >
                      {entry.source}
                    </span>
                    <div className={cn("min-w-0 flex-1", levelTone[entry.level])}>
                      <span className="font-semibold">{entry.label}</span>
                      {entry.details && (
                        <span className="ml-1 text-muted-foreground" title={entry.details}>
                          {entry.details}
                        </span>
                      )}
                      {metaStr && (
                        <span
                          className="ml-1 text-[10px] text-muted-foreground/80 break-all"
                          title={fullMetaJson}
                        >
                          {metaStr}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <ReportProblemDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        snapshot={reportSnapshot}
      />
    </div>
  );
});
