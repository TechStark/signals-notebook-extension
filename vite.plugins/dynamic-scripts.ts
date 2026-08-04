import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import type { Plugin, ResolvedConfig } from 'vite';

const SCRIPTS = {
  content: fileURLToPath(new URL('../src/content/index.ts', import.meta.url)),
  injected: fileURLToPath(new URL('../src/injected/index.ts', import.meta.url)),
} as const;

/**
 * Bundles scripts that are registered at runtime via
 * chrome.scripting.registerContentScripts() (see src/background/index.ts)
 * rather than declared in manifest.content_scripts. @crxjs/vite-plugin only
 * knows how to process scripts declared in the manifest, so these are built
 * standalone with esbuild — self-contained, no shared chunks — to a stable
 * output path (dist/src/<name>/index.js) that matches what the background
 * worker references by string.
 */
export function dynamicScripts(): Plugin {
  let config: ResolvedConfig;

  const build = async (outdir: string) => {
    const result = await esbuild.build({
      entryPoints: SCRIPTS,
      bundle: true,
      format: 'esm',
      target: 'chrome115',
      outbase: 'virtual',
      entryNames: '[name]/index',
      outdir: path.join(outdir, 'src'),
      alias: { '@shared': fileURLToPath(new URL('../src/shared', import.meta.url)) },
      loader: { '.tsx': 'tsx', '.ts': 'ts' },
      jsx: 'automatic',
      metafile: true,
    });
    return Object.keys(result.metafile.inputs).map((file) => path.resolve(file));
  };

  return {
    name: 'dynamic-scripts',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async closeBundle() {
      if (config.command === 'build') await build(config.build.outDir);
    },
    async configureServer(server) {
      let tracked = new Set(await build(config.build.outDir));
      const syncWatcher = (files: Iterable<string>) => {
        for (const file of files) server.watcher.add(file);
      };
      syncWatcher(tracked);

      server.watcher.on('change', async (file) => {
        if (!tracked.has(file)) return;
        const inputs = await build(config.build.outDir);
        tracked = new Set(inputs);
        syncWatcher(tracked);

        // @crxjs/vite-plugin only sends its `crx:runtime-reload` HMR signal
        // for files it tracks via Vite's module graph (background +
        // manifest.content_scripts). Since content/injected are built out of
        // band by esbuild above, crx never sees this change and the
        // extension never reloads on its own. Send the same payload crx
        // itself uses so its background/content HMR clients pick it up and
        // call chrome.runtime.reload().
        server.ws.send({ type: 'custom', event: 'crx:runtime-reload' });
      });
    },
  };
}
