import { getConfig, hostToMatchPattern, onConfigChanged, type ExtensionConfig } from '@shared/config';
import type { RuntimeMessage } from '@shared/messaging';

const CONTENT_SCRIPT_ID = 'snb-content';

/**
 * (Re)registers the dynamic content script against every configured SNB
 * host that currently has a granted permission. Content scripts can't be
 * scoped statically in manifest.json since the target domains are only
 * known at runtime (see docs/architecture.md). Hosts without a granted
 * permission are silently skipped rather than blocking the others.
 */
async function syncContentScriptRegistration(config: ExtensionConfig): Promise<void> {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  if (existing.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  }

  const candidateMatches = config.snbHosts.map(hostToMatchPattern);
  const matches = [];
  for (const pattern of candidateMatches) {
    if (await chrome.permissions.contains({ origins: [pattern] })) matches.push(pattern);
  }
  if (matches.length === 0) return;

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches,
      js: ['src/content/index.js'],
      runAt: 'document_idle',
    },
  ]);
}

chrome.runtime.onInstalled.addListener(async () => {
  await syncContentScriptRegistration(await getConfig());
});

onConfigChanged((config) => {
  void syncContentScriptRegistration(config);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'GET_CONFIG') {
    void getConfig().then(sendResponse);
    return true;
  }

  if (message.type === 'REQUEST_HOST_PERMISSION') {
    void chrome.permissions.request({ origins: [hostToMatchPattern(message.host)] }).then(sendResponse);
    return true;
  }

  return false;
});
