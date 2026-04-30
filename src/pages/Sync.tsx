import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useIptv } from "@/context/IptvContext";
import {
  getLiveCategories,
  getLiveStreams,
  getVodCategories,
  getVodStreams,
  getSeriesCategories,
  getSeries,
} from "@/services/iptv";
import {
  preloadIndex,
  preloadLive,
  preloadMovies,
  preloadSeries,
  preloadAccount,
} from "@/App";

const logoSuperTech = "/logo-supertech.webp";

type StepStatus = "pending" | "loading" | "done" | "error";

interface SyncStep {
  key: string;
  label: string;
  run: () => Promise<void>;
}

const Sync = () => {
  const navigate = useNavigate();
  const { session } = useIptv();
  const queryClient = useQueryClient();
  const startedRef = useRef(false);

  const creds = session?.creds;

  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [allDone, setAllDone] = useState(false);
  const [hasError, setHasError] = useState(false);

  const steps: SyncStep[] = creds
    ? [
        {
          key: "live",
          label: "TV ao vivo",
          run: async () => {
            const cats = await getLiveCategories(creds);
            const streams = await getLiveStreams(creds);
            queryClient.setQueryData(["live-cats", creds.username], cats);
            queryClient.setQueryData(["live-streams", creds.username], streams);
          },
        },
        {
          key: "movies",
          label: "Filmes",
          run: async () => {
            const cats = await getVodCategories(creds);
            const streams = await getVodStreams(creds);
            queryClient.setQueryData(["vod-cats", creds.username], cats);
            queryClient.setQueryData(["vod-streams", creds.username], streams);
          },
        },
        {
          key: "series",
          label: "Séries",
          run: async () => {
            const cats = await getSeriesCategories(creds);
            const list = await getSeries(creds);
            queryClient.setQueryData(["series-cats", creds.username], cats);
            queryClient.setQueryData(["series", creds.username], list);
          },
        },
      ]
    : [];

  const runSync = async () => {
    if (!creds) return;
    setHasError(false);
    setAllDone(false);
    setErrors({});
    setStatuses(Object.fromEntries(steps.map((s) => [s.key, "pending"])));

    // Pré-carrega os bundles JS das rotas em paralelo com os dados.
    [preloadIndex, preloadLive, preloadMovies, preloadSeries, preloadAccount].forEach(
      (fn) => {
        try {
          fn();
        } catch {
          /* ignore preload errors */
        }
      },
    );

    let anyError = false;

    // Roda em SÉRIE para evitar limite de conexões.
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setStatuses((prev) => ({ ...prev, [step.key]: "loading" }));

      let lastErr: unknown = null;
      const attempts = [0, 8000, 20000];
      for (const wait of attempts) {
        if (wait) await new Promise((r) => setTimeout(r, wait));
        try {
          await step.run();
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          const msg = e instanceof Error ? e.message : String(e);
          if (!/MAX_CONNECTIONS|429|Limite de telas/i.test(msg)) break;
        }
      }

      if (lastErr) {
        anyError = true;
        const raw = lastErr instanceof Error ? lastErr.message : "Erro";
        const friendly = /MAX_CONNECTIONS|Limite de telas/i.test(raw)
          ? "Limite de telas atingido nesta conta. Aguarde alguns minutos e tente novamente."
          : raw;
        setErrors((prev) => ({ ...prev, [step.key]: friendly }));
        setStatuses((prev) => ({ ...prev, [step.key]: "error" }));
      } else {
        setStatuses((prev) => ({ ...prev, [step.key]: "done" }));
      }

      // Pequena pausa entre steps.
      if (i < steps.length - 1) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    if (anyError) {
      setHasError(true);
    } else {
      // Forçar atualização do QueryClient para garantir que os dados sejam marcados como frescos
      await queryClient.invalidateQueries();
      setAllDone(true);
      setTimeout(() => navigate("/", { replace: true }), 600);
    }
  };

  useEffect(() => {
    if (!creds) {
      navigate("/login", { replace: true });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = steps.length || 1;
  const doneCount = Object.values(statuses).filter((s) => s === "done").length;
  const progress = Math.round((doneCount / total) * 100);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(214_100%_56%/0.15),transparent_50%)]" />

      <Card className="relative w-full max-w-md p-8 bg-gradient-card border-border/50 shadow-card animate-scale-in">
        <div className="text-center mb-6">
          <img
            src={logoSuperTech}
            alt="SuperTech"
            width={80}
            height={80}
            className="mx-auto h-20 w-20 object-contain mb-3 drop-shadow-[0_0_24px_hsl(var(--primary)/0.45)]"
          />
          <h1 className="text-2xl font-bold tracking-tight">
            Sincronizando seu <span className="text-gradient">conteúdo</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-2">
            Carregando catálogo para navegação instantânea
          </p>
        </div>

        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{doneCount} de {total}</span>
            <span>{progress}%</span>
          </div>
        </div>

        <ul className="space-y-2 mb-6">
          {steps.map((step) => {
            const status = statuses[step.key] ?? "pending";
            return (
              <li
                key={step.key}
                className="flex items-center gap-3 text-sm py-1.5 px-2 rounded-md"
              >
                <span className="w-5 flex items-center justify-center shrink-0">
                  {status === "loading" && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {status === "done" && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                  {status === "error" && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  {status === "pending" && (
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                  )}
                </span>
                <span
                  className={
                    status === "error"
                      ? "text-destructive"
                      : status === "done"
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }
                >
                  {step.label}
                </span>
                {status === "error" && errors[step.key] && (
                  <span className="ml-auto text-[11px] text-destructive/80 truncate max-w-[140px]">
                    {errors[step.key]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {hasError && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">
              Algumas etapas falharam ao carregar o conteúdo. Tente novamente
              ou volte para a tela anterior.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button
                className="flex-1 bg-gradient-primary hover:opacity-90"
                onClick={() => runSync()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {allDone && (
          <p className="text-xs text-center text-muted-foreground">
            Tudo pronto! Redirecionando…
          </p>
        )}
      </Card>
    </div>
  );
};

export default Sync;
