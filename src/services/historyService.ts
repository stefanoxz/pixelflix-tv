
export interface WatchProgress {
  streamId: string;
  currentTime: number;
  duration: number;
  lastUpdated: number;
  completed: boolean;
}

class HistoryService {
  private STORAGE_KEY = 'pixelflix_history';

  getProgress(streamId: string): WatchProgress | null {
    const history = this.getAll();
    return history[streamId] || null;
  }

  saveProgress(streamId: string, currentTime: number, duration: number) {
    if (!streamId || !duration) return;
    
    const history = this.getAll();
    const completed = currentTime / duration > 0.9; // Marked as watched if > 90%
    
    history[streamId] = {
      streamId,
      currentTime,
      duration,
      lastUpdated: Date.now(),
      completed: completed || (history[streamId]?.completed ?? false)
    };
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  }

  markWatched(streamId: string) {
    const history = this.getAll();
    history[streamId] = {
      streamId,
      currentTime: 0,
      duration: 0,
      lastUpdated: Date.now(),
      completed: true
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  }

  private getAll(): Record<string, WatchProgress> {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}

export const historyService = new HistoryService();
