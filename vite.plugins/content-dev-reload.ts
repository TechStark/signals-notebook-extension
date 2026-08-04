import type { Plugin, ResolvedConfig } from 'vite';

const VIRTUAL_MODULE_ID = 'virtual:snb-content-dev-reload';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
const POLL_PATH = '/__snb_dev__/content-reload';
/** Keeps a background long-poll request from hanging forever across a service worker suspend/wake cycle. */
const LONG_POLL_TIMEOUT_MS = 20_000;

/**
 * Dev-only bridge that lets `src/background/index.ts` learn when the
 * dynamically-registered content/injected scripts (see dynamic-scripts.ts)
 * have been rebuilt, so it can re-inject just those scripts into already-open
 * tabs instead of relying on @crxjs/vite-plugin's `crx:runtime-reload` —
 * which reloads the *entire* extension and navigates every matched tab via
 * `location.reload()`, discarding all host page state (unsaved SNB edits,
 * scroll position, Redux store, etc).
 *
 * Protocol: the background worker long-polls GET `POLL_PATH`. This plugin
 * resolves the pending request as soon as `notifyContentChanged()` is
 * called (200 = "something changed, re-inject"), or after
 * `LONG_POLL_TIMEOUT_MS` with no change (204 = "still nothing, poll again").
 * Either way the background loop immediately issues the next poll — this is
 * just a live-updating "has content.js changed?" flag, not a message queue.
 *
 * The dev server's own base URL is only known once the server actually
 * starts, so it's exposed to background/index.ts via the virtual module
 * `virtual:snb-content-dev-reload`. Service workers can't use dynamic
 * `import()` (disallowed by spec), so background/index.ts imports it
 * statically and only *uses* the value behind an `import.meta.env.DEV`
 * check — which Vite dead-code-eliminates in production builds. Outside
 * `serve` mode this module resolves to an empty placeholder instead of not
 * existing at all, since the static import itself must still resolve
 * during `vite build`.
 */
export function contentDevReload() {
  let resolveWaiters: Array<() => void> = [];

  function notifyContentChanged() {
    const waiters = resolveWaiters;
    resolveWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  let config: ResolvedConfig;

  const plugin: Plugin = {
    name: 'content-dev-reload',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return;
      // Outside `vite dev` there's no server to poll — background/index.ts
      // never touches this in that case (see the import.meta.env.DEV guard
      // there), but the import must still statically resolve during
      // `vite build` since service workers can't use dynamic import().
      if (config.command !== 'serve') {
        return `export const CONTENT_RELOAD_URL = '';`;
      }
      const protocol = config.server.https ? 'https' : 'http';
      const port = config.server.port ?? 5173;
      return `
        export const CONTENT_RELOAD_URL = ${JSON.stringify(`${protocol}://localhost:${port}${POLL_PATH}`)};
      `;
    },
    configureServer(server) {
      server.middlewares.use(POLL_PATH, (_req, res) => {
        let settled = false;
        const finish = (status: number) => {
          if (settled) return;
          settled = true;
          res.statusCode = status;
          res.end();
        };
        const timer = setTimeout(() => finish(204), LONG_POLL_TIMEOUT_MS);
        resolveWaiters.push(() => {
          clearTimeout(timer);
          finish(200);
        });
      });
    },
  };

  return { plugin, notifyContentChanged };
}
