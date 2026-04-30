import { XtreamCredentials, UserInfo, Category, Stream } from '../types';
import { supabase } from './supabase';

export class XtreamService {
  private credentials: XtreamCredentials | null = null;

  setCredentials(creds: XtreamCredentials) {
    // Ensure URL doesn't have trailing slash
    const formattedUrl = creds.url.replace(/\/$/, '');
    this.credentials = { ...creds, url: formattedUrl };
  }

  getCredentials() {
    return this.credentials;
  }

  private async fetchAction(action: string, params: Record<string, string> = {}) {
    if (!this.credentials) throw new Error('No credentials set');

    const searchParams = new URLSearchParams({
      username: this.credentials.username,
      password: this.credentials.password,
      action,
      ...params,
    });

    const url = `${this.credentials.url}/player_api.php?${searchParams.toString()}`;
    console.log(`Fetching action: ${action} from ${url}`);

    // IPTV servers often fail with some proxies. 
    // We'll try multiple proxies in parallel to find the fastest one that works.
    const proxies = [
      (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`,
      (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      (u: string) => `https://cors-anywhere.herokuapp.com/${u}`, // Note: might require demo access
    ];

    for (const getProxyUrl of proxies) {
      try {
        const proxyUrl = getProxyUrl(url);
        console.log(`Trying proxy: ${proxyUrl}`);
        const response = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(10000) // 10s timeout per proxy
        });

        if (!response.ok) continue;

        let data;
        if (proxyUrl.includes('allorigins')) {
          const json = await response.json();
          data = JSON.parse(json.contents);
        } else {
          data = await response.json();
        }

        if (data) {
          console.log(`Success with proxy for ${action}`);
          return data;
        }
      } catch (err) {
        console.warn(`Proxy failed for ${action}:`, err);
        continue;
      }
    }

    throw new Error(`All proxies failed for ${action}`);
  }

  async authenticate(): Promise<{ user_info: UserInfo }> {
    const data = await this.fetchAction('');
    if (!data.user_info || data.user_info.auth === 0) {
      throw new Error('Authentication failed');
    }
    return data;
  }

  async getCategories(type: 'live' | 'movie' | 'series'): Promise<Category[]> {
    const action = type === 'live' ? 'get_live_categories' : type === 'movie' ? 'get_vod_categories' : 'get_series_categories';
    return this.fetchAction(action);
  }

  async getStreams(type: 'live' | 'movie' | 'series', categoryId?: string): Promise<Stream[]> {
    const action = type === 'live' ? 'get_live_streams' : type === 'movie' ? 'get_vod_streams' : 'get_series_streams';
    const params = categoryId ? { category_id: categoryId } : {};
    return this.fetchAction(action, params);
  }

  getStreamUrl(streamId: string, extension: string = 'm3u8', type: 'live' | 'movie' | 'series' = 'live'): string {
    if (!this.credentials) return '';
    const prefix = type === 'live' ? '' : type === 'movie' ? 'movie/' : 'series/';
    return `${this.credentials.url}/${prefix}${this.credentials.username}/${this.credentials.password}/${streamId}.${extension}`;
  }
}

export const xtreamService = new XtreamService();
