import { IptvCredentials, Stream, Category } from '../types/iptv';

export function parseM3uUrl(input: string): IptvCredentials | null {
  try {
    const url = new URL(input.trim());
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');
    const server = `${url.protocol}//${url.host}`;

    if (username && password) {
      return { server, username, password };
    }
  } catch (e) {}
  return null;
}

export async function fetchM3u(creds: IptvCredentials): Promise<string> {
  const url = `${creds.server}/get.php?username=${creds.username}&password=${creds.password}&type=m3u_plus&output=ts`;
  // Usando um proxy CORS público para desenvolvimento se necessário, 
  // ou assumindo que o servidor permite (geralmente não permite, precisa de backend real ou proxy)
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao carregar lista");
  return await res.text();
}

export function parseM3uToStreams(m3u: string): Stream[] {
  const lines = m3u.split('\n');
  const streams: Stream[] = [];
  let current: Partial<Stream> = {};

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.+)$/);
      const iconMatch = line.match(/tvg-logo="([^"]+)"/);
      const catMatch = line.match(/group-title="([^"]+)"/);
      
      current = {
        name: nameMatch ? nameMatch[1] : 'Canal Sem Nome',
        stream_icon: iconMatch ? iconMatch[1] : '',
        category_id: catMatch ? catMatch[1] : '0',
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
  return streams;
}
