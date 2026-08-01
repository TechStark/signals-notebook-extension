# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install
pnpm dev     # vite dev server, builds to dist/ in watch mode
pnpm build   # tsc --noEmit then vite build
```

There is no lint, format, or test setup yet. Don't invent commands for them.

Load the extension in Chrome via `chrome://extensions` → enable Developer mode → "Load unpacked" → select `dist/`. After loading, open the extension's options page and add at least one Signals Notebook host to grant access — without this, the content/injected scripts never run.

## Architecture

This is a Chrome MV3 extension that layers enhancements onto Signals Notebook, a React+Redux SPA. Users may have several SNB environments (dev/staging/self-hosted instances) and none of their domains are known until runtime. That constraint drives most of the non-obvious structure below.

### Why there's no `content_scripts` entry in the manifest

`manifest.config.ts` declares `optional_host_permissions: ["https://*/*"]` and `permissions: ["scripting", "storage", "activeTab"]` but no `content_scripts`. Static `matches` patterns can't be changed at runtime, and SNB hosts are only known once the user adds them in the options page. So instead:

1. `src/options/OptionsApp.tsx` lets the user add any number of hosts — a literal host (`my-instance.signalsnotebook.com`) or a subdomain wildcard (`*.signalsnotebook.com`) — validated by `isValidSnbHost`, and calls `chrome.runtime.sendMessage({ type: 'REQUEST_HOST_PERMISSION', host })` for each one individually.
2. `src/background/index.ts` requests that specific host via `chrome.permissions.request()`, then registers a single content script whose `matches` array covers every configured host that currently has a granted permission (hosts saved but not yet granted are skipped, not blocking).
3. The registration is kept in sync with the stored config via `onConfigChanged` (fires on any `chrome.storage.sync` change) and on `chrome.runtime.onInstalled`.

Subdomain wildcards work because Chrome's match pattern syntax only allows `*` as the leftmost host label — exactly what `chrome.permissions.request()` / `registerContentScripts()` accept natively, no extra parsing needed. Arbitrary wildcard positions aren't supported by the platform.

Keep this pattern when touching domain/permission logic — don't add a static `matches` entry back into `manifest.config.ts`, and don't collapse `snbHosts` back to a single value.

### Context boundaries (`src/<context>/`)

Each directory under `src/` is a distinct runtime context with its own privileges; don't blur them:

- **`background/`** — service worker. Pure orchestration only: reads config, manages permissions, registers/unregisters the dynamic content script, relays messages. No feature/business logic belongs here — it's non-persistent and gets killed/woken by Chrome at will.
- **`content/`** — isolated world, dynamically registered against the configured SNB hosts (not declared statically). Entry point (`index.ts`) should stay a thin bootstrapper; actual enhancement logic goes in sibling modules.
- **`injected/`** — main world (page JS context). Bridge for reaching page globals the isolated world can't see (e.g. a Redux store instance). Talks to `content/` exclusively via `window.postMessage`, validated with `isBridgeMessage`.
- **`popup/`**, **`options/`** — each is its own HTML document/entry, rendered with React + antd (`main.tsx` mounts `PopupApp`/`OptionsApp` via `createRoot`). `content/`, `injected/`, and `background/` stay plain TS/DOM — React is deliberately scoped to the two standalone extension pages, not injected into the host page. `options/` is where SNB hosts are added/removed and permissions are requested.
- **`shared/`** — the only code imported across contexts. `config.ts` wraps `chrome.storage.sync` (the single source of truth for the configured host list, `snbHosts: string[]`); `messaging.ts` defines the message protocol types for both the postMessage bridge and `chrome.runtime` messages. Add new message shapes here rather than inlining ad-hoc objects in a context file.

Cross-context imports must go through `@shared/*` (aliased to `src/shared`) — configured in both `tsconfig.json` paths and `vite.config.ts` resolve.alias.

### Surviving the host SPA's re-renders

`src/content/mount.ts` mounts a Shadow DOM host on `document.documentElement` — deliberately not inside any node React manages — and re-attaches it via `MutationObserver` if the SPA removes it. Any content-script UI should render into the `ShadowRoot` this returns, never touch the page DOM directly, and stay idempotent (check-before-create) since content scripts can re-run.

### Build: why `content`/`injected` bypass the normal Vite/crx pipeline

`vite.plugins/dynamic-scripts.ts` bundles `src/content` and `src/injected` standalone via esbuild, emitting to a fixed path (`dist/src/<name>/index.js`) that `src/background/index.ts` references by string literal. This exists because `@crxjs/vite-plugin` only processes scripts declared in `manifest.content_scripts`; routing these two through it (or through `build.rollupOptions.input`) fails to resolve the `@shared` alias in dev mode specifically — production `vite build` masked the bug by taking a different internal path. If you touch this plugin, verify both `pnpm dev` and `pnpm build` produce working `dist/src/content/index.js` and `dist/src/injected/index.js`, not just one.

### UI stack: React + antd, but only in popup/options

`@vitejs/plugin-react` is pinned to `^5.2.0`, not the newer 6.x line — 6.x requires Vite 8 as a peer, and this project is on Vite 7. Don't bump it without also bumping Vite. antd v6 uses CSS-in-JS (no separate stylesheet import needed); `ConfigProvider` wraps each page's root, and `OptionsApp.tsx` additionally wraps in antd's `App` component to get access to `message`/`notification` via `App.useApp()`. If a future enhancement needs UI inside `content/` (i.e. rendered into the page), don't reflexively reuse React/antd there — that's a separate decision (bundle size and Shadow DOM style-injection behavior differ) and hasn't been made yet.
