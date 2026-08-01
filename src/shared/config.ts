/** Extension-wide settings persisted in chrome.storage.sync. */
export interface ExtensionConfig {
  /** User-configured Signals Notebook origin, e.g. "https://my-instance.signalsnotebook.com". */
  snbOrigin: string | null;
}

const STORAGE_KEY = 'config';

const DEFAULT_CONFIG: ExtensionConfig = {
  snbOrigin: null,
};

export async function getConfig(): Promise<ExtensionConfig> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  return { ...DEFAULT_CONFIG, ...stored[STORAGE_KEY] };
}

export async function setConfig(config: ExtensionConfig): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: config });
}

export function onConfigChanged(callback: (config: ExtensionConfig) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[STORAGE_KEY]) return;
    callback({ ...DEFAULT_CONFIG, ...changes[STORAGE_KEY].newValue });
  });
}

/** Derives a match pattern (e.g. "https://host/*") from a configured origin. */
export function originToMatchPattern(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/*`;
}
