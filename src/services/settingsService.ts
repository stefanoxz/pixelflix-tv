export type PlayerType = 'm3u8' | 'ts';

export interface AppSettings {
  playerType: PlayerType;
  adultLockEnabled: boolean;
  adultPin: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  playerType: 'm3u8',
  adultLockEnabled: true,
  adultPin: '0000',
};

class SettingsService {
  private settings: AppSettings = DEFAULT_SETTINGS;

  constructor() {
    this.load();
  }

  private load() {
    try {
      let stored = localStorage.getItem('vibe_settings');
      if (!stored) {
        stored = localStorage.getItem('pixelflix_settings');
      }
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      this.settings = DEFAULT_SETTINGS;
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.save();
  }

  reset() {
    this.settings = DEFAULT_SETTINGS;
    this.save();
  }

  private save() {
    try {
      localStorage.setItem('vibe_settings', JSON.stringify(this.settings));
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }
}

export const settingsService = new SettingsService();
