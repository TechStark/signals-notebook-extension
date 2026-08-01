# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install
pnpm dev     # vite dev server, builds to dist/ in watch mode
pnpm build   # tsc --noEmit then vite build
```

There is no lint, format, or test setup yet. Don't invent commands for them.

Load the extension in Chrome via `chrome://extensions` → enable Developer mode → "Load unpacked" → select `dist/`. After loading, open the extension's options page and enter a Signals Notebook URL to grant host access — without this, the content/injected scripts never run.

## Architecture

This is a Chrome MV3 extension that layers enhancements onto Signals Notebook, a React+Redux SPA whose domain is only known at runtime (users self-host or use different instances). That one constraint drives most of the non-obvious structure below.

### Why there's no `content_scripts` entry in the manifest

`manifest.config.ts` declares `optional_host_permissions: ["https://*/*"]` and `permissions: ["scripting", "storage", "activeTab"]` but no `content_scripts`. Static `matches` patterns can't be changed at runtime, and the target SNB origin isn't known until the user enters it in the options page. So instead:

1. `src/options/options.ts` collects the origin and calls `chrome.runtime.sendMessage({ type: 'REQUEST_HOST_PERMISSION', origin })`.
2. `src/background/index.ts` requests that specific origin via `chrome.permissions.request()`, then calls `chrome.scripting.registerContentScripts()` scoped to it.
3. The registration is kept in sync with the stored config via `onConfigChanged` (fires on any `chrome.storage.sync` change) and on `chrome.runtime.onInstalled`.

Keep this pattern when touching domain/permission logic — don't add a static `matches` entry back into `manifest.config.ts`.

### Context boundaries (`src/<context>/`)

Each directory under `src/` is a distinct runtime context with its own privileges; don't blur them:

- **`background/`** — service worker. Pure orchestration only: reads config, manages permissions, registers/unregisters the dynamic content script, relays messages. No feature/business logic belongs here — it's non-persistent and gets killed/woken by Chrome at will.
- **`content/`** — isolated world, dynamically registered against the configured SNB origin (not declared statically). Entry point (`index.ts`) should stay a thin bootstrapper; actual enhancement logic goes in sibling modules.
- **`injected/`** — main world (page JS context). Bridge for reaching page globals the isolated world can't see (e.g. a Redux store instance). Talks to `content/` exclusively via `window.postMessage`, validated with `isBridgeMessage`.
- **`popup/`**, **`options/`** — each is its own HTML document/entry, built with plain DOM APIs (no framework). `options/` is where the SNB origin is configured and permissions are requested.
- **`shared/`** — the only code imported across contexts. `config.ts` wraps `chrome.storage.sync` (the single source of truth for the configured origin); `messaging.ts` defines the message protocol types for both the postMessage bridge and `chrome.runtime` messages. Add new message shapes here rather than inlining ad-hoc objects in a context file.

Cross-context imports must go through `@shared/*` (aliased to `src/shared`) — configured in both `tsconfig.json` paths and `vite.config.ts` resolve.alias.

### Surviving the host SPA's re-renders

`src/content/mount.ts` mounts a Shadow DOM host on `document.documentElement` — deliberately not inside any node React manages — and re-attaches it via `MutationObserver` if the SPA removes it. Any content-script UI should render into the `ShadowRoot` this returns, never touch the page DOM directly, and stay idempotent (check-before-create) since content scripts can re-run.

### Build: why `content`/`injected` bypass the normal Vite/crx pipeline

`vite.plugins/dynamic-scripts.ts` bundles `src/content` and `src/injected` standalone via esbuild, emitting to a fixed path (`dist/src/<name>/index.js`) that `src/background/index.ts` references by string literal. This exists because `@crxjs/vite-plugin` only processes scripts declared in `manifest.content_scripts`; routing these two through it (or through `build.rollupOptions.input`) fails to resolve the `@shared` alias in dev mode specifically — production `vite build` masked the bug by taking a different internal path. If you touch this plugin, verify both `pnpm dev` and `pnpm build` produce working `dist/src/content/index.js` and `dist/src/injected/index.js`, not just one.
