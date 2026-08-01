# Architecture

## Contexts

| Directory | Runs in | Responsibility |
|---|---|---|
| `src/background` | Service worker | Reads config from `chrome.storage.sync`, registers/unregisters the dynamic content script via `chrome.scripting`, brokers optional host permission requests. No feature/business logic. |
| `src/content` | Isolated world, dynamically registered on the user-configured SNB origin | Mounts a Shadow DOM host on `document.documentElement` and hosts enhancement features. |
| `src/injected` | Main world (page context) | Bridge for enhancements that need access to page globals (e.g. a Redux store instance) unreachable from the isolated world. Communicates with `content` via `window.postMessage`. |
| `src/popup` | Extension popup (own document, React + antd) | Quick-glance status / shortcuts. |
| `src/options` | Extension options page (own document, React + antd) | User configures the target SNB hosts; triggers the `optional_host_permissions` request flow. |
| `src/shared` | n/a (imported by all contexts) | Config storage helpers, cross-context message types. |

## Why the target domain isn't in `manifest.json`

`content_scripts.matches` is static and can't be changed at runtime, but SNB
domains are only known once the user enters them in the options page — and
users may have several environments (e.g. `dev.signalsnotebook.com`,
`staging.signalsnotebook.com`). So:

1. `manifest.json` declares `optional_host_permissions: ["https://*/*"]` and
   `permissions: ["scripting", "storage"]`, but no `content_scripts` entry.
2. The options page lets the user add any number of hosts — either a literal
   host (`my-instance.signalsnotebook.com`) or a subdomain wildcard
   (`*.signalsnotebook.com`) — and calls `chrome.permissions.request()` for
   each one individually (see `src/options/OptionsApp.tsx`).
3. Once granted, the background worker registers a single content script
   whose `matches` array covers every host that currently has a granted
   permission (see `src/background/index.ts`). Hosts saved to config but not
   yet granted are skipped rather than blocking the others.

Subdomain wildcards work because Chrome's match pattern syntax allows `*` only
as the leftmost label of the host (`*.example.com`), which is exactly what
`chrome.permissions.request()` and `registerContentScripts()` accept natively
— no extra parsing needed. Arbitrary wildcard positions (mid-label, in the
path, etc.) aren't supported by the platform, so unrelated domains still need
to be added as separate literal entries. `isValidSnbHost` in `src/shared/config.ts`
enforces this shape at input time.

This keeps the extension's footprint minimal (no all-sites access at install
time) and keeps Chrome Web Store review friction low.

## Surviving React re-renders

The content script mounts its Shadow DOM host on `document.documentElement`
rather than inside any node React manages, and a `MutationObserver`
re-attaches it if removed. See `src/content/mount.ts`. Enhancement UI should
render into the returned `ShadowRoot`, not touch the page DOM directly.

## UI stack

`popup/` and `options/` are rendered with React and antd (v6, CSS-in-JS —
no separate stylesheet import), each with its own `main.tsx` entry calling
`createRoot`. This is a deliberate choice for the two standalone extension
pages only — `content/`, `injected/`, and `background/` remain plain
TypeScript/DOM. Pulling React into `content/` (i.e. rendered into the host
page) is a separate decision with different tradeoffs (bundle size injected
into every matching page, CSS-in-JS behavior inside a Shadow DOM) and hasn't
been made.
