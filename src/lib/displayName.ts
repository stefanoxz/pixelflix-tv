/**
 * Personalização do nome de exibição do cliente.
 *
 * Guardamos por dispositivo (localStorage) e por username IPTV. Assim, o mesmo
 * login pode ter "apelidos" diferentes em cada aparelho da casa (ex: celular
 * do filho = "Pedro", celular da mãe = "Ana"). Sem backend, sem requisição.
 */

import { useEffect, useState } from "react";
import { z } from "zod";

const NAME_PREFIX = "display_name:";
const SEEN_PREFIX = "display_name_seen:";

/** Aceita letras (com acento), números, espaço, apóstrofo, ponto e hífen. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Digite um nome")
  .max(20, "Máximo 20 caracteres")
  .regex(/^[\p{L}\p{N}\s'.-]+$/u, "Use apenas letras, números e espaços");

const safeUsername = (username: string) => username.trim();

/** Lê o nome salvo. Retorna `""` se nunca foi definido ou foi limpo. */
export function getDisplayName(username: string): string {
  if (!username) return "";
  try {
    return localStorage.getItem(NAME_PREFIX + safeUsername(username)) ?? "";
  } catch {
    return "";
  }
}

/** Salva o nome (já sanitizado por displayNameSchema). */
export function setDisplayName(username: string, name: string): void {
  if (!username) return;
  try {
    localStorage.setItem(NAME_PREFIX + safeUsername(username), name);
    window.dispatchEvent(new CustomEvent("display-name-change", { detail: { username } }));
  } catch {
    /* localStorage pode estar bloqueado (modo privado em alguns browsers) */
  }
}

/** Remove o nome (volta a saudação genérica). */
export function clearDisplayName(username: string): void {
  if (!username) return;
  try {
    localStorage.removeItem(NAME_PREFIX + safeUsername(username));
    window.dispatchEvent(new CustomEvent("display-name-change", { detail: { username } }));
  } catch {
    /* noop */
  }
}

export function hasSeenWelcomeModal(username: string): boolean {
  if (!username) return true; // sem usuário = não mostrar
  try {
    return localStorage.getItem(SEEN_PREFIX + safeUsername(username)) === "1";
  } catch {
    return true;
  }
}

export function markWelcomeModalSeen(username: string): void {
  if (!username) return;
  try {
    localStorage.setItem(SEEN_PREFIX + safeUsername(username), "1");
  } catch {
    /* noop */
  }
}

/**
 * Retorna a saudação apropriada para o horário do dispositivo:
 * - 05:00–11:59 → "Bom dia"
 * - 12:00–17:59 → "Boa tarde"
 * - 18:00–04:59 → "Boa noite"
 */
export function getGreeting(date: Date = new Date()): "Bom dia" | "Boa tarde" | "Boa noite" {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Hook que reage a mudanças no nome (ex: usuário edita em outra tela). Re-render
 * automático via evento customizado disparado pelo `setDisplayName`/`clearDisplayName`.
 */
/**
 * Abrevia um nome para caber em espaços compactos (ex: header mobile),
 * preservando a identidade do cliente.
 *
 * Regras:
 * - Vazio → "".
 * - Cabe inteiro em `maxLen` → mantém como está.
 * - Tem 2+ palavras → tenta "Primeiro Ú." (primeira palavra + inicial da última).
 * - Se ainda exceder → usa só o primeiro nome, truncado com reticências.
 */
export function abbreviateName(name: string, maxLen = 12): string {
  const trimmed = (name ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.length <= maxLen) return trimmed;

  const parts = trimmed.split(" ");
  if (parts.length >= 2) {
    const first = parts[0];
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    const candidate = `${first} ${lastInitial}.`;
    if (candidate.length <= maxLen) return candidate;
  }

  const first = parts[0];
  if (first.length <= maxLen) return first;
  // Reserva 1 char para o ellipsis.
  return first.slice(0, Math.max(1, maxLen - 1)) + "…";
}

export function useDisplayName(username: string): string {
  const [name, setName] = useState(() => getDisplayName(username));

  useEffect(() => {
    setName(getDisplayName(username));
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ username: string }>).detail;
      if (!detail || detail.username === username) {
        setName(getDisplayName(username));
      }
    };
    window.addEventListener("display-name-change", handler);
    return () => window.removeEventListener("display-name-change", handler);
  }, [username]);

  return name;
}
