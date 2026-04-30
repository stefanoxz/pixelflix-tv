import { IptvCredentials, Stream, Category } from '../types/iptv';

export function parseM3uUrl(input: string): IptvCredentials | null {
  if (!input) return null;
  const raw = input.trim();
  
  try {
    if (raw.startsWith('http')) {
      const url = new URL(raw);
      const username = url.searchParams.get('username');
      const password = url.searchParams.get('password');
      const server = `${url.protocol}//${url.host}`;

      if (username && password) {
        return { server, username, password };
      }
    }
    
    const userMatch = raw.match(/username=([^&]+)/);
    const passMatch = raw.match(/password=([^&]+)/);
    const hostMatch = raw.match(/(https?:\/\/[^/?#]+)/);
    
    if (userMatch && passMatch && hostMatch) {
      return {
        server: hostMatch[1],
        username: userMatch[1],
        password: passMatch[1]
      };
    }
  } catch (e) {
    console.error("Parser Error:", e);
  }
  return null;
}

export async function fetchM3u(creds: IptvCredentials): Promise<string> {
  const url = `${creds.server}/get.php?username=${creds.username}&password=${creds.password}&type=m3u_plus&output=ts`;
  const proxy = "https://api.allorigins.win/raw?url=";
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const res = await fetch(proxy + encodeURIComponent(url), { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text || text.length < 50) throw new Error("Resposta inválida do servidor");
    return text;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error("Tempo de conexão esgotado");
    throw err;
  }
}

export function parseM3uToData(m3u: string): { streams: Stream[], categories: Category[] } {
  const lines = m3u.split('\n');
  const streams: Stream[] = [];
  const categoriesMap = new Map<string, string>();
  let current: Partial<Stream> = {};

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.+)$/);
      const iconMatch = line.match(/tvg-logo="([^"]+)"/);
      const catMatch = line.match(/group-title="([^"]+)"/);
      
      const categoryName = (catMatch ? catMatch[1] : 'Canais').trim();
      categoriesMap.set(categoryName, categoryName);

      current = {
        name: nameMatch ? nameMatch[1].trim() : 'Canal Sem Nome',
        stream_icon: iconMatch ? iconMatch[1] : '',
        category_id: categoryName,
        stream_type: 'live'
      };
    } else if (line.startsWith('http')) {
      if (current.name) {
        current.direct_source = line;
        // Gera um ID único baseado no nome e na URL para evitar duplicatas em renderização
        current.stream_id = Math.abs(hashString(current.name + line));
        streams.push(current as Stream);
        current = {};
      }
    }
  }

  const categories: Category[] = Array.from(categoriesMap.keys()).sort().map(name => ({
    category_id: name,
    category_name: name
  }));

  return { streams, categories };
}

// Helper simples para gerar hash de string (para IDs)
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}
