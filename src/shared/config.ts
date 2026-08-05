import type { LabelTemplates } from './printTypes';

/** Extension-wide settings persisted in chrome.storage.sync. */
export interface ExtensionConfig {
  /**
   * User-configured Signals Notebook hosts, e.g. "my-instance.signalsresearch.revvitycloud.com"
   * or a subdomain wildcard like "*.signalsresearch.revvitycloud.com". Always https, no path.
   */
  snbHosts: string[];
}

const STORAGE_KEY = 'config';

const DEFAULT_CONFIG: ExtensionConfig = {
  snbHosts: [],
};

const TEMPLATES_KEY = 'printTemplates';
const DEFAULT_TEMPLATES: LabelTemplates = {
  templates: [],
};

/** A host label is alphanumeric/hyphen segments separated by dots; the leftmost segment may be a literal "*". */
const HOST_PATTERN = /^(\*|[a-z0-9]([a-z0-9-]*[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export function isValidSnbHost(host: string): boolean {
  return HOST_PATTERN.test(host);
}

export async function getConfig(): Promise<ExtensionConfig> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  const storedConfig = stored[STORAGE_KEY] as ExtensionConfig | undefined;
  return { ...DEFAULT_CONFIG, ...storedConfig };
}

export async function setConfig(config: ExtensionConfig): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: config });
}

export function onConfigChanged(callback: (config: ExtensionConfig) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[STORAGE_KEY]) return;
    const newValue = changes[STORAGE_KEY].newValue as ExtensionConfig | undefined;
    callback({ ...DEFAULT_CONFIG, ...newValue });
  });
}

/** Derives a match pattern (e.g. "https://*.host.com/*") from a configured host. */
export function hostToMatchPattern(host: string): string {
  return `https://${host}/*`;
}

/** Retrieves the label templates from storage. */
export async function getLabelTemplates(): Promise<LabelTemplates> {
  const stored = await chrome.storage.sync.get(TEMPLATES_KEY);
  const storedTemplates = stored[TEMPLATES_KEY] as LabelTemplates | undefined;
  return { ...DEFAULT_TEMPLATES, ...storedTemplates };
}

/** Saves the label templates to storage. */
export async function setLabelTemplates(templates: LabelTemplates): Promise<void> {
  await chrome.storage.sync.set({ [TEMPLATES_KEY]: templates });
}

/** Listens for changes to label templates. */
export function onTemplatesChanged(callback: (templates: LabelTemplates) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[TEMPLATES_KEY]) return;
    const newValue = changes[TEMPLATES_KEY].newValue as LabelTemplates | undefined;
    callback({ ...DEFAULT_TEMPLATES, ...newValue });
  });
}
