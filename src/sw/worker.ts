// The service worker (#9): once the app has been opened, it keeps working
// without a network. The build (tools/serviceWorker.ts) turns this file into
// dist/sw.js with the list of the build's files in front of it, as `PRECACHE`;
// the page registers it with the scope /debate/ (src/offline/register.ts).
//
// The rest of the origin (plinklabs.org/) is another site: the worker answers
// only for its own scope and only touches its own caches.
//
// A new version installs in the background and then waits. It takes over only
// when the page asks for it, on the teacher's click (src/offline/updates.ts),
// so a deploy never swaps the app in the middle of a debate.

/** Put in front of this file by the build. */
interface Precache {
  /** Changes whenever a file of the build changes. */
  readonly version: string;
  /** Every file of the build, relative to the scope. */
  readonly files: readonly string[];
}

declare const PRECACHE: Precache;
declare const self: ServiceWorkerGlobalScope;

/** The message the page sends to let a waiting version take over. */
const SKIP_WAITING = 'skip-waiting';

const PREFIX = 'debate-precache-';
const CACHE = `${PREFIX}${PRECACHE.version}`;
/** https://plinklabs.org/debate/ */
const SCOPE = self.registration.scope;
/** What every page of the app is: the one HTML file. */
const SHELL = new URL('index.html', SCOPE).href;

// A version is installed whole or not at all. Each file is checked with the
// server ('no-cache'), so a file the browser still has from an older version
// is not taken for this one.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          PRECACHE.files.map((file) => new Request(new URL(file, SCOPE), { cache: 'no-cache' })),
        ),
      ),
  );
});

// The previous version's files go; pages that have none yet get this one.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const old = (await caches.keys()).filter((name) => name.startsWith(PREFIX) && name !== CACHE);
      await Promise.all(old.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data: unknown = event.data;
  if (typeof data === 'object' && data !== null && 'type' in data && data.type === SKIP_WAITING) {
    void self.skipWaiting();
  }
});

// The app's own files come from the cache; a page of the app is the one HTML
// file. Anything else, or a file the cache lacks, goes to the network.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;
  event.respondWith(respond(request));
});

// Each file is cached under its own URL, once: a `Vary` header from the server
// (`Vary: Origin`, say) does not make it another file.
async function respond(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  const cached =
    (await cache.match(request, { ignoreVary: true })) ??
    (request.mode === 'navigate' ? await cache.match(SHELL, { ignoreVary: true }) : undefined);
  return cached ?? fetch(request);
}
