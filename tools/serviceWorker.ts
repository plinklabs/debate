import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { transformWithOxc, type Plugin, type ResolvedConfig } from 'vite';

// Builds the service worker (#9): src/sw/worker.ts, without its types, as
// sw.js next to index.html, with the list of the files to keep offline in
// front of it. That list is every file of the build, the public files
// included, and a version that changes when any of them does: a new deploy is
// a new sw.js, which the browser picks up as an update.

const WORKER = 'src/sw/worker.ts';
const OUTPUT = 'sw.js';

/**
 * Not kept offline: the .woff fallbacks of the fonts (every browser with a
 * service worker takes the .woff2), and source maps.
 */
const SKIPPED = /\.(woff|map)$/;

function publicFiles(dir: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  if (dir === '') return files;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set(relative(dir, path).split(sep).join('/'), readFileSync(path));
  }
  return files;
}

export function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'debate:service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    generateBundle: {
      // After index.html is made.
      order: 'post',
      async handler(_options, bundle) {
        const files = new Map<string, string | Uint8Array>(
          config.build.copyPublicDir ? publicFiles(config.publicDir) : [],
        );
        for (const output of Object.values(bundle)) {
          files.set(output.fileName, output.type === 'chunk' ? output.code : output.source);
        }
        const kept = [...files.keys()].filter((name) => !SKIPPED.test(name)).sort();
        if (!kept.includes('index.html')) this.error('The service worker needs index.html.');

        const source = readFileSync(resolve(config.root, WORKER), 'utf8');
        const hash = createHash('sha256').update(source);
        for (const name of kept) hash.update(`\0${name}\0`).update(files.get(name)!);
        const precache = { version: hash.digest('hex').slice(0, 16), files: kept };

        const { code } = await transformWithOxc(source, WORKER, { lang: 'ts' });
        this.emitFile({
          type: 'asset',
          fileName: OUTPUT,
          source: `const PRECACHE = ${JSON.stringify(precache)};\n${code}`,
        });
      },
    },
  };
}
