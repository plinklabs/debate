// @vitest-environment node
// Rules about what the model modules may import, checked on their source.
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Modules that make up a shareable config (link, file). */
const SHAREABLE = ['./config.ts', './validate.ts', './presets.ts', './locale.ts'];

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function importsOf(source: string): string[] {
  const code = withoutComments(source);
  return [...code.matchAll(/\bfrom\s+'([^']+)'|\bimport\s*\(?\s*'([^']+)'/g)].map(
    (match) => match[1] ?? match[2],
  );
}

/** Every module reachable from `start` through relative imports. */
function reachableFrom(start: string): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  for (let module = queue.pop(); module !== undefined; module = queue.pop()) {
    if (seen.has(module)) continue;
    seen.add(module);
    for (const target of importsOf(sources[module] ?? '')) queue.push(`${target}.ts`);
  }
  return seen;
}

describe('the model', () => {
  it('has its modules where this test looks', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining([...SHAREABLE, './session.ts', './reducer.ts', './storage.ts']),
    );
  });

  it.each(Object.keys(sources))('%s imports only other model modules', (module) => {
    for (const target of importsOf(sources[module])) {
      expect(target, `${module} imports ${target}`).toMatch(/^\.\/[a-z-]+$/);
      expect(Object.keys(sources), `${module} imports ${target}`).toContain(`${target}.ts`);
    }
  });

  it.each(Object.keys(sources))('%s uses no browser globals', (module) => {
    expect(withoutComments(sources[module])).not.toMatch(
      /\b(window|document|navigator|localStorage|sessionStorage|performance|HTMLElement)\b/,
    );
  });

  it.each(SHAREABLE)('%s cannot reach the private session modules', (module) => {
    expect([...reachableFrom(module)].filter((reached) => !SHAREABLE.includes(reached))).toEqual(
      [],
    );
  });
});
