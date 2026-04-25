/**
 * Extrai credenciais Xtream de uma URL M3U / stream / API.
 *
 * Formatos suportados:
 *   http://server[:porta]/get.php?username=X&password=Y[&type=m3u_plus...]
 *   http://server[:porta]/player_api.php?username=X&password=Y[&action=...]
 *   http://server[:porta]/playlist/<user>/<pass>/[m3u_plus|m3u|ts]
 *   http://server[:porta]/live/<user>/<pass>/<id>.ts
 *   http://server[:porta]/movie/<user>/<pass>/<id>.<ext>
 *   http://server[:porta]/series/<user>/<pass>/<id>.<ext>
 *   http://server[:porta]/<user>/<pass>/<id>           (Xtream legacy)
 *
 * Aceita o input com ou sem protocolo (assume http://) e tolera texto
 * adicional ao redor — busca a primeira URL plausível.
 *
 * Retorna null se nenhum formato Xtream reconhecido for encontrado.
 */
export type M3uCredentials = {
  /** Origin completo: "http://host[:port]" — sem trailing slash. */
  server: string;
  username: string;
  password: string;
  /** Path detectado, útil para o diagnóstico (ex: "/get.php", "/player_api.php"). */
  path?: string;
};

const MAX_INPUT_LEN = 2000;

/** Extrai a primeira sequência que pareça uma URL no input. */
function extractFirstUrl(raw: string): string | null {
  // 1) URL absoluta com protocolo
  const withProto = raw.match(/https?:\/\/[^\s"'<>]+/i);
  if (withProto) return withProto[0];

  // 2) host[:port]/path — assume http://
  const hostPath = raw.match(
    /[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d+)?\/[^\s"'<>]*/i,
  );
  if (hostPath) return `http://${hostPath[0]}`;

  // 3) host[:port] sozinho
  const hostOnly = raw.match(/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d+)?/i);
  if (hostOnly) return `http://${hostOnly[0]}`;

  return null;
}

export function parseM3uUrl(input: string): M3uCredentials | null {
  if (!input) return null;
  const raw = input.trim().slice(0, MAX_INPUT_LEN);
  if (!raw) return null;

  const candidate = extractFirstUrl(raw);
  if (!candidate) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.host) return null;

  const server = `${url.protocol}//${url.host}`;
  const path = url.pathname;

  // Variante 1: get.php?username=X&password=Y
  if (/\/get\.php\/?$/i.test(path)) {
    const username = url.searchParams.get("username")?.trim();
    const password = url.searchParams.get("password") ?? "";
    if (username && password) return { server, username, password };
  }

  // Variante 2: /playlist/<user>/<pass>/<type>
  const pl = path.match(
    /\/playlist\/([^/]+)\/([^/]+)(?:\/(?:m3u_plus|m3u|ts))?\/?$/i,
  );
  if (pl) {
    try {
      const username = decodeURIComponent(pl[1]).trim();
      const password = decodeURIComponent(pl[2]);
      if (username && password) return { server, username, password };
    } catch {
      /* fallthrough */
    }
  }

  return null;
}
