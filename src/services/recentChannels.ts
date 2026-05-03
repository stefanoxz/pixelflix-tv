// Service to track recently watched channels in localStorage

const KEY = 'recent_channels';
const MAX = 20;

export interface RecentChannel {
  id: string;
  name: string;
  icon: string;
  watchedAt: number; // timestamp
}

export const recentChannelsService = {
  getAll(): RecentChannel[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  },

  add(channel: any): void {
    try {
      const list = this.getAll().filter((c) => c.id !== String(channel.stream_id || channel.id));
      list.unshift({
        id: String(channel.stream_id || channel.id),
        name: channel.name || 'Canal',
        icon: channel.stream_icon || channel.icon || '',
        watchedAt: Date.now(),
      });
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch {}
  },

  remove(id: string): void {
    try {
      const list = this.getAll().filter((c) => c.id !== id);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {}
  },

  clear(): void {
    localStorage.removeItem(KEY);
  },
};
