import { useEffect, useState, useCallback } from "react";

/**
 * Evento padronizado pelo Chrome/Edge/Brave que dispara quando o navegador
 * detecta que o site é instalável como PWA. O `prompt()` precisa ser
 * chamado em resposta a um gesto do usuário (clique).
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISSED_KEY = "supertech-pwa-install-dismissed";
const INSTALLED_KEY = "supertech-pwa-installed";

/** True quando o app foi aberto a partir da home screen / instalado. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari expõe `navigator.standalone`; Chrome/Edge usam media query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iosStandalone = (window.navigator as any).standalone === true;
  const mqStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  return iosStandalone || mqStandalone;
}

/** Detecta iOS — onde `beforeinstallprompt` não existe e a instalação é manual. */
function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  // iPhone/iPod sempre, e iPad moderno (que se identifica como Mac com touch).
  const iPadOS =
    /Mac/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

/**
 * Hook que orquestra a instalação PWA:
 *  - captura `beforeinstallprompt` (Chrome/Edge/Brave/Opera)
 *  - detecta iOS (sem evento → instruções manuais)
 *  - respeita rejeição persistida do usuário ("nunca mais")
 *  - oculta tudo se o app já está instalado (standalone)
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (installed) return;

    const onBeforeInstallPrompt = (e: Event) => {
      // Impede o mini-infobar nativo do Chrome — vamos mostrar nosso próprio modal.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      try {
        localStorage.setItem(INSTALLED_KEY, "1");
      } catch {
        /* noop */
      }
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // Detecta mudança de display-mode (usuário instalou e abriu como app).
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onChange = () => {
      if (mq?.matches) setInstalled(true);
    };
    mq?.addEventListener?.("change", onChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      mq?.removeEventListener?.("change", onChange);
    };
  }, [installed]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      try {
        localStorage.setItem(INSTALLED_KEY, "1");
      } catch {
        /* noop */
      }
    }
    return choice.outcome;
  }, [deferredPrompt]);

  const dismissForever = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* noop */
    }
    setDismissed(true);
    setDeferredPrompt(null);
  }, []);

  const ios = isIos();

  return {
    /** true se o navegador disparou o evento e podemos chamar `promptInstall()`. */
    canPrompt: !!deferredPrompt,
    /** true em iOS (Safari): mostrar instruções manuais. */
    isIos: ios,
    /** true se o app já está rodando instalado (standalone). */
    installed,
    /** true se o usuário recusou definitivamente. */
    dismissed,
    promptInstall,
    dismissForever,
  };
}
