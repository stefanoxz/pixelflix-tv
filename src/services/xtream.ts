import { XtreamCredentials, UserInfo, Category, Stream } from '../types';
import { supabase } from './supabase';
import { settingsService } from './settingsService';

export class XtreamError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'XtreamError';
  }
}

export class XtreamService {
  private credentials: XtreamCredentials | null = null;
  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private CACHE_DURATION = 1000 * 60 * 10; // 10 minutes cache for list data

  setCredentials(creds: XtreamCredentials) {
    try {
      if (!creds.url || !creds.username || !creds.password) {
        throw new Error('Credenciais incompletas');
      }
      // Ensure URL has protocol and no trailing slash
      let url = creds.url.trim().replace(/\/$/, '');
      if (!url.startsWith('http')) {
        url = `http://${url}`;
      }
      this.credentials = { ...creds, url };
    } catch (err) {
      console.error('Error setting credentials:', err);
      throw new XtreamError('Erro ao configurar servidor IPTV');
    }
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
    } catch (err: any) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new Error('Tempo de resposta excedido (Timeout)');
      }
      throw err;
    }
  }

  private async fetchAction(action: string, params: Record<string, string> = {}) {
    if (!this.credentials) {
      throw new XtreamError('Servidor não configurado', 'NO_CONFIG');
    }

    const cacheKey = `${action}-${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    const searchParams = new URLSearchParams({
      username: this.credentials.username,
      password: this.credentials.password,
      action,
      ...params,
    });

    const url = `${this.credentials.url}/player_api.php?${searchParams.toString()}`;
    const isStreamAction = action.includes('streams') || action.includes('series');
    const timeout = isStreamAction ? 25000 : 12000;

    const proxies = [
      (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      (u: string) => `https://cors-anywhere.herokuapp.com/${u}`,
      (u: string) => `https://proxy.cors.sh/${u}`,
      (u: string) => u,
    ];

    let lastError: any = null;

    for (const getProxyUrl of proxies) {
      try {
        const proxyUrl = getProxyUrl(url);
        const response = await this.fetchWithTimeout(proxyUrl, timeout);

        if (!response.ok) continue;

        let data;
        const isAllOrigins = proxyUrl.includes('allorigins');

        if (isAllOrigins) {
          const json = await response.json();
          if (!json.contents) continue;
          try {
            data = JSON.parse(json.contents);
          } catch { continue; }
        } else {
          data = await response.json();
        }

        if (data) {
          // Validation of IPTV response format
          if (data.status === false || (data.user_info && data.user_info.auth === 0)) {
            throw new XtreamError(data.message || 'Usuário ou senha inválidos no servidor IPTV', 'AUTH_FAILED');
          }
          
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
          return data;
        }
      } catch (err: any) {
        if (err instanceof XtreamError) throw err;
        lastError = err;
        continue;
      }
    }

    const userFriendlyMessage = lastError?.message?.includes('Timeout') 
      ? 'O servidor demorou muito para responder. Tente novamente.'
      : 'Não foi possível conectar ao servidor. Verifique a URL e sua internet.';
      
    throw new XtreamError(userFriendlyMessage, 'NETWORK_ERROR', lastError);
  }

  private serverTimeOffset = 0; // Offset in seconds

  async authenticate(): Promise<{ user_info: UserInfo }> {
    try {
      const data = await this.fetchAction('');
      if (!data.user_info || data.user_info.auth === 0) {
        throw new XtreamError('Acesso negado pelo servidor IPTV', 'AUTH_FAILED');
      }
      
      // Calculate server time offset
      if (data.server_info && data.server_info.server_time) {
        const serverTime = parseInt(data.server_info.server_time);
        const localTime = Math.floor(Date.now() / 1000);
        this.serverTimeOffset = serverTime - localTime;
        console.log(`Server time offset: ${this.serverTimeOffset}s`);
      }

      return data;
    } catch (err: any) {
      if (err instanceof XtreamError) throw err;
      throw new XtreamError('Falha na autenticação. Verifique os dados.', 'UNKNOWN');
    }
  }

  getServerTime(): number {
    return Math.floor(Date.now() / 1000) + this.serverTimeOffset;
  }

  async getCategories(type: 'live' | 'movie' | 'series'): Promise<Category[]> {
    try {
      const action = type === 'live' ? 'get_live_categories' : type === 'movie' ? 'get_vod_categories' : 'get_series_categories';
      const data = await this.fetchAction(action);
      
      if (Array.isArray(data)) return data;
      if (typeof data === 'object' && data !== null) return Object.values(data);
      return [];
    } catch (err) {
      console.warn(`Error fetching ${type} categories:`, err);
      return []; // Return empty instead of crashing for lists
    }
  }

  async getStreams(type: 'live' | 'movie' | 'series', categoryId?: string): Promise<Stream[]> {
    try {
      const action = type === 'live' ? 'get_live_streams' : type === 'movie' ? 'get_vod_streams' : 'get_series';
      const params = categoryId ? { category_id: categoryId } : {};
      const data = await this.fetchAction(action, params);
      
      if (Array.isArray(data)) return data;
      if (typeof data === 'object' && data !== null) return Object.values(data);
      return [];
    } catch (err) {
      console.warn(`Error fetching ${type} streams:`, err);
      return [];
    }
  }

  getStreamUrl(streamId: string, extension: string = '', type: 'live' | 'movie' | 'series' = 'live'): string {
    if (!this.credentials) return '';
    const baseUrl = this.credentials.url.replace(/\/$/, '');
    const prefix = type === 'live' ? '' : type === 'movie' ? 'movie/' : 'series/';
    
    // Get extension from settings if not explicitly provided
    const { playerType } = settingsService.getSettings();
    const ext = extension || (type === 'live' ? 'm3u8' : playerType === 'ts' ? 'ts' : 'mp4');
    
    return `${baseUrl}/${prefix}${this.credentials.username}/${this.credentials.password}/${streamId}.${ext}`;
  }

  async getShortEPG(streamId: string): Promise<any[]> {
    try {
      const data = await this.fetchAction('get_short_epg', { stream_id: streamId, limit: '10' });
      
      if (data && data.epg_listings && Array.isArray(data.epg_listings)) {
        return data.epg_listings;
      }
      return [];
    } catch (err) {
      console.warn(`Error fetching EPG for stream ${streamId}:`, err);
      return [];
    }
  }
}

export const xtreamService = new XtreamService();
