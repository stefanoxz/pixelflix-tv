import { XtreamCredentials, UserInfo, Category, Stream } from '../types';
import { supabase } from './supabase';

export class XtreamService {
  private credentials: XtreamCredentials | null = null;

  setCredentials(creds: XtreamCredentials) {
    this.credentials = creds;
  }

  getCredentials() {
    return this.credentials;
  }

  private async fetchAction(action: string, params: Record<string, string> = {}) {
    if (!this.credentials) throw new Error('No credentials set');

    const { data, error } = await supabase.functions.invoke('xtream-proxy', {
      body: {
        url: this.credentials.url,
        username: this.credentials.username,
        password: this.credentials.password,
        action,
        ...params,
      },
    });

    if (error) {
      console.error('Error calling xtream-proxy:', error);
      throw error;
    }

    return data;
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
    // Stream URLs are usually direct and don't require the proxy if the server allows it,
    // but the video player might also face CORS if we are not careful.
    // For now, keep it direct as stream URLs often have their own redirection logic.
    return `${this.credentials.url}/${prefix}${this.credentials.username}/${this.credentials.password}/${streamId}.${extension}`;
  }
}

export const xtreamService = new XtreamService();
