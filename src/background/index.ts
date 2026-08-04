import { getConfig, hostToMatchPattern, onConfigChanged, type ExtensionConfig } from '@shared/config';
import type { RuntimeMessage } from '@shared/messaging';
import { CONTENT_RELOAD_URL } from 'virtual:snb-content-dev-reload';

const CONTENT_SCRIPT_ID = 'snb-content';
const CONTENT_SCRIPT_FILE = 'src/content/index.js';

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

  const matches = await getGrantedMatchPatterns(config);
  if (matches.length === 0) return;

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      matches,
      js: [CONTENT_SCRIPT_FILE],
      runAt: 'document_idle',
    },
  ]);
}

/**
 * Grants access to the same match patterns syncContentScriptRegistration()
 * just registered against, i.e. every configured host with a granted
 * permission.
 */
async function getGrantedMatchPatterns(config: ExtensionConfig): Promise<string[]> {
  const matches: string[] = [];
  for (const host of config.snbHosts) {
    const pattern = hostToMatchPattern(host);
    if (await chrome.permissions.contains({ origins: [pattern] })) matches.push(pattern);
  }
  return matches;
}

/**
 * Dev-only hot reload: re-runs the content script in every already-open
 * matching tab instead of reloading the whole extension (which would also
 * force-navigate every tab via location.reload(), losing host page state).
 * Re-execution is safe for plain DOM/observer setup because content/mount.ts
 * and friends are written to be idempotent — see CLAUDE.md. It is *not*
 * inherently safe for anything backed by a long-lived module singleton like
 * a React root: the bundle's top-level bindings are plain `var`s sharing one
 * global scope across executions, so re-running it immediately rebinds
 * React/ReactDOM/etc. out from under any still-mounted tree, corrupting it
 * on its next render ("Invalid hook call", null dispatcher errors). That's
 * why cleanup runs first, calling back into the *old* execution's own
 * `window.__snbExtCleanup` (see src/content/sampleEnhancement.tsx) to
 * synchronously unmount before any of that rebinding happens.
 *
 * Note this still re-runs each module's other top-level side effects
 * (version fetch, MutationObserver registration, etc.) on every hot
 * reload, so long dev sessions with many edits can accumulate duplicate
 * listeners; restart the extension occasionally if that becomes visible.
 */
async function reinjectContentScript(): Promise<void> {
  const matches = await getGrantedMatchPatterns(await getConfig());
  if (matches.length === 0) return;

  const tabs = await chrome.tabs.query({ url: matches });
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) return;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => (window as unknown as { __snbExtCleanup?: () => Promise<void> }).__snbExtCleanup?.(),
        });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT_FILE] });
        console.log(`[SNB Extension] Hot-reloaded content script in tab ${tab.id}`);
      } catch (e) {
        console.error(`[SNB Extension] Failed to hot-reload content script in tab ${tab.id}:`, e);
      }
    }),
  );
}

/**
 * Long-polls the dev server for content/injected rebuilds and hot-reloads
 * open tabs in response. Fully dead-code-eliminated in production builds:
 * `import.meta.env.DEV` is statically replaced with `false`, so this
 * function is never called there (the `CONTENT_RELOAD_URL` import above
 * resolves to a harmless empty string outside `vite dev` — see
 * vite.plugins/content-dev-reload.ts — since service workers can't use
 * dynamic `import()` to defer loading it).
 */
async function startContentDevReloadLoop(): Promise<void> {
  while (true) {
    try {
      const res = await fetch(CONTENT_RELOAD_URL);
      if (res.status === 200) await reinjectContentScript();
    } catch (e) {
      console.warn('[SNB Extension] Content dev-reload poll failed, retrying:', e);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

if (import.meta.env.DEV) {
  void startContentDevReloadLoop();
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
