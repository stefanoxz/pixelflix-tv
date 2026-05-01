import { XtreamCredentials, UserInfo, Category, Stream } from '../types';
import { supabase } from './supabase';

export class XtreamService {
  private credentials: XtreamCredentials | null = null;
  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private CACHE_DURATION = 1000 * 60 * 10; // 10 minutes cache for list data

  setCredentials(creds: XtreamCredentials) {
    // Ensure URL has protocol and no trailing slash
    let url = creds.url.trim().replace(/\/$/, '');
    if (!url.startsWith('http')) {
      url = `http://${url}`;
    }
    this.credentials = { ...creds, url };
  }

  getCredentials() {
    return this.credentials;
  }

  private async fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  private async fetchAction(action: string, params: Record<string, string> = {}) {
    if (!this.credentials) throw new Error('No credentials set');

    const cacheKey = `${action}-${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`Returning cached data for ${action}`);
      return cached.data;
    }

    const searchParams = new URLSearchParams({
      username: this.credentials.username,
      password: this.credentials.password,
      action,
      ...params,
    });

    const url = `${this.credentials.url}/player_api.php?${searchParams.toString()}`;
    console.log(`Fetching action: ${action}`);

    // IPTV servers are picky. We use proxies to bypass CORS.
    // Increased timeout for streams which can be very large
    const isStreamAction = action.includes('streams') || action.includes('series');
    const timeout = isStreamAction ? 20000 : 10000;

    const proxies = [
      (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`,
    ];

    let lastError: any = null;

    for (const getProxyUrl of proxies) {
      try {
        const proxyUrl = getProxyUrl(url);
        console.log(`Trying proxy for ${action}...`);
        
        const response = await this.fetchWithTimeout(proxyUrl, timeout);

        if (!response.ok) {
          console.warn(`Proxy returned status ${response.status} for ${action}`);
          continue;
        }

        let data;
        const proxyName = proxyUrl.includes('allorigins') ? 'allorigins' : 
                         proxyUrl.includes('corsproxy.io') ? 'corsproxy' : 'thingproxy';

        if (proxyName === 'allorigins') {
          const json = await response.json();
          if (!json.contents) continue;
          try {
            data = JSON.parse(json.contents);
          } catch (e) {
            console.warn("AllOrigins: Failed to parse contents", e);
            continue;
          }
        } else {
          data = await response.json();
        }

        if (data) {
          // Handle cases where data is an error object
          if (data.status === false || (data.user_info && data.user_info.auth === 0)) {
            throw new Error(data.message || 'Falha na autenticação do servidor');
          }
          console.log(`Success with ${proxyName} for ${action}`);
          
          // Cache the successful result
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
          
          return data;
        }
      } catch (err) {
        console.warn(`Proxy failed for ${action}:`, err);
        lastError = err;
        continue;
      }
    }

    throw lastError || new Error(`Não foi possível carregar os dados. O servidor IPTV pode estar lento ou bloqueando a conexão.`);
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
    const data = await this.fetchAction(action);
    
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && data !== null) {
      // Some servers return categories as an object { "0": {...}, "1": {...} }
      return Object.values(data);
    }
    return [];
  }

  async getStreams(type: 'live' | 'movie' | 'series', categoryId?: string): Promise<Stream[]> {
    const action = type === 'live' ? 'get_live_streams' : type === 'movie' ? 'get_vod_streams' : 'get_series_streams';
    const params = categoryId ? { category_id: categoryId } : {};
    const data = await this.fetchAction(action, params);
    
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && data !== null) {
      return Object.values(data);
    }
    return [];
  }

  getStreamUrl(streamId: string, extension: string = 'm3u8', type: 'live' | 'movie' | 'series' = 'live'): string {
    if (!this.credentials) return '';
    const prefix = type === 'live' ? '' : type === 'movie' ? 'movie/' : 'series/';
    return `${this.credentials.url}/${prefix}${this.credentials.username}/${this.credentials.password}/${streamId}.${extension}`;
  }
}

export const xtreamService = new XtreamService();
