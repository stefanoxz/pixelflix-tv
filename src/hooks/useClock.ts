import { useEffect, useState } from "react";

/**
 * Relógio reativo: HH:MM (24h) + data abreviada ptBR (Sáb., 25/04).
 * Atualiza a cada 30s (suficiente para minuto).
 */
export function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Sincroniza no próximo "minuto cheio" e depois roda a cada 30s.
    const ms = 30_000;
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Sáb., 25/04
  const dayShort = now.toLocaleDateString("pt-BR", { weekday: "short" });
  const cap = dayShort.charAt(0).toUpperCase() + dayShort.slice(1);
  const dm = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const date = `${cap}, ${dm}`;

  return { time, date, now };
}
