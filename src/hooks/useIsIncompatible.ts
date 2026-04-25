import { useEffect, useState } from "react";
import { isIncompatible } from "@/lib/incompatibleContent";

/**
 * Reativo: retorna se (host+id) está marcado como incompatível.
 * Re-avalia quando outras partes do app marcam/desmarcam (CustomEvent
 * "incompatible-content-changed") ou quando o evento `storage` chega de
 * outra aba.
 */
export function useIsIncompatible(
  host: string | null | undefined,
  id: number | string | null | undefined,
): boolean {
  const [value, setValue] = useState(() => isIncompatible(host, id));

  useEffect(() => {
    setValue(isIncompatible(host, id));
    const refresh = () => setValue(isIncompatible(host, id));
    window.addEventListener("incompatible-content-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("incompatible-content-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [host, id]);

  return value;
}
