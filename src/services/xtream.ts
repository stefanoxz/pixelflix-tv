import { XtreamCredentials, UserInfo, Category, Stream } from '../types';

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

    const searchParams = new URLSearchParams({
      username: this.credentials.username,
      password: this.credentials.password,
      action,
      ...params,
    });

    const response = await fetch(`${this.credentials.url}/player_api.php?${searchParams.toString()}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return response.json();
  }

  async authenticate(): Promise<{ user_info: UserInfo }> {
    return this.fetchAction('');
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
