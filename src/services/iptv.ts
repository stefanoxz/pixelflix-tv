import { IptvCredentials, Stream, Category } from '../types/iptv';

export function parseM3uUrl(input: string): IptvCredentials | null {
  if (!input) return null;
  const raw = input.trim();
  
  try {
    // Tenta como URL completa primeiro
    if (raw.startsWith('http')) {
      const url = new URL(raw);
      const username = url.searchParams.get('username');
      const password = url.searchParams.get('password');
      const server = `${url.protocol}//${url.host}`;

      if (username && password) {
        return { server, username, password };
      }
    }
    
    // Tenta extrair credenciais se o usuário colou apenas partes ou formatos diferentes
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
    console.error("Erro no parser de URL:", e);
  }
  return null;
}

export async function fetchM3u(creds: IptvCredentials): Promise<string> {
  const url = `${creds.server}/get.php?username=${creds.username}&password=${creds.password}&type=m3u_plus&output=ts`;
  // Proxy CORS público robusto
  const proxy = "https://api.allorigins.win/raw?url=";
  const res = await fetch(proxy + encodeURIComponent(url));
  if (!res.ok) throw new Error("Falha na resposta do proxy");
  const text = await res.text();
  if (!text || text.length < 100) throw new Error("Lista vazia ou inválida");
  return text;
}

export function parseM3uToData(m3u: string): { streams: Stream[], categories: Category[] } {
  const lines = m3u.split('\n');
  const streams: Stream[] = [];
  const categoriesMap = new Map<string, string>();
  let current: Partial<Stream> = {};

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.+)$/);
      const iconMatch = line.match(/tvg-logo="([^"]+)"/);
      const catMatch = line.match(/group-title="([^"]+)"/);
      
      const categoryName = catMatch ? catMatch[1] : 'Canais';
      categoriesMap.set(categoryName, categoryName);

      current = {
        name: nameMatch ? nameMatch[1].trim() : 'Canal Sem Nome',
        stream_icon: iconMatch ? iconMatch[1] : '',
        category_id: categoryName,
        stream_id: streams.length + 1,
        stream_type: 'live'
      };
    } else if (line.startsWith('http')) {
      if (current.name) {
        current.direct_source = line;
        streams.push(current as Stream);
        current = {};
      }
    }
  }

  const categories: Category[] = Array.from(categoriesMap.keys()).map(name => ({
    category_id: name,
    category_name: name
  }));

  return { streams, categories };
}
