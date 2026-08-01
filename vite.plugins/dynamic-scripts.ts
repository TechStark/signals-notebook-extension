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
    await esbuild.build({
      entryPoints: SCRIPTS,
      bundle: true,
      format: 'esm',
      target: 'chrome115',
      outbase: 'virtual',
      entryNames: '[name]/index',
      outdir: path.join(outdir, 'src'),
      alias: { '@shared': fileURLToPath(new URL('../src/shared', import.meta.url)) },
    });
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
      await build(config.build.outDir);
      for (const file of Object.values(SCRIPTS)) {
        server.watcher.add(file);
      }
      server.watcher.on('change', async (file) => {
        if (Object.values(SCRIPTS).includes(file)) await build(config.build.outDir);
      });
    },
  };
}
