# Architecture

## Contexts

| Directory | Runs in | Responsibility |
|---|---|---|
| `src/background` | Service worker | Reads config from `chrome.storage.sync`, registers/unregisters the dynamic content script via `chrome.scripting`, brokers optional host permission requests. No feature/business logic. |
| `src/content` | Isolated world, dynamically registered on the user-configured SNB origin | Mounts a Shadow DOM host on `document.documentElement` and hosts enhancement features. |
| `src/injected` | Main world (page context) | Bridge for enhancements that need access to page globals (e.g. a Redux store instance) unreachable from the isolated world. Communicates with `content` via `window.postMessage`. |
| `src/popup` | Extension popup (own document) | Quick-glance status / shortcuts. |
| `src/options` | Extension options page (own document) | User configures the target SNB domain; triggers the `optional_host_permissions` request flow. |
| `src/shared` | n/a (imported by all contexts) | Config storage helpers, cross-context message types. |

## Why the target domain isn't in `manifest.json`

`content_scripts.matches` is static and can't be changed at runtime, but the
SNB domain is only known once the user enters it in the options page. So:

1. `manifest.json` declares `optional_host_permissions: ["https://*/*"]` and
   `permissions: ["scripting", "storage"]`, but no `content_scripts` entry.
2. The options page collects the user's SNB origin and calls
   `chrome.permissions.request()` for that specific origin only (see
   `src/options/options.ts`).
3. Once granted, the background worker calls
   `chrome.scripting.registerContentScripts()` scoped to that origin (see
   `src/background/index.ts`).

This keeps the extension's footprint minimal (no all-sites access at install
time) and keeps Chrome Web Store review friction low.

## Surviving React re-renders

The content script mounts its Shadow DOM host on `document.documentElement`
rather than inside any node React manages, and a `MutationObserver`
re-attaches it if removed. See `src/content/mount.ts`. Enhancement UI should
render into the returned `ShadowRoot`, not touch the page DOM directly.
