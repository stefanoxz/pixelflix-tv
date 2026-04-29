import { useEffect, useState } from "react";
import { useAdminRole } from "@/hooks/useAdminRole";

const STORAGE_KEY = "admin.playerLogs.enabled";
const EVENT = "admin-player-logs-toggle";

/**
 * Decide se o painel "Logs do player" deve aparecer no `<Player>`.
 *
 * Só fica disponível para admins (não vale para moderators) que tenham
 * ativado o toggle em /admin → Manutenção. Usuário comum nunca vê o botão
 * nem o painel — a coleta interna de logs continua funcionando para
 * telemetria, só a UI fica oculta.
 */
export function usePlayerLogsEnabled(): boolean {
  const { isAdmin } = useAdminRole();
  const [enabled, setEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; }
    catch { return false; }
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabled(e.newValue === "1");
    };
    const onCustom = () => {
      try { setEnabled(localStorage.getItem(STORAGE_KEY) === "1"); }
      catch { /* noop */ }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, onCustom);
    };
  }, []);

  // Limpeza defensiva: se o usuário NÃO é admin mas tinha alguma flag
  // antiga, remove para não vazar painel em sessões trocadas.
  useEffect(() => {
    if (isAdmin) return;
    try {
      localStorage.removeItem("player.logsPanel.open");
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* noop */ }
  }, [isAdmin]);

  return isAdmin && enabled;
}

export function setPlayerLogsEnabled(value: boolean) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch { /* noop */ }
}

export function getPlayerLogsEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; }
  catch { return false; }
}
