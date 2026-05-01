export type PlayerType = 'm3u8' | 'ts';

export interface AppSettings {
  playerType: PlayerType;
  p2pEnabled: boolean;
  adultLockEnabled: boolean;
  adultPin: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  playerType: 'm3u8',
  p2pEnabled: true,
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
      const stored = localStorage.getItem('pixelflix_settings');
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
      localStorage.setItem('pixelflix_settings', JSON.stringify(this.settings));
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }
}

export const settingsService = new SettingsService();
