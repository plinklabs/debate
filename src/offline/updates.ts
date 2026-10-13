// A new version of the app, waiting to take over (#9). After a deploy, the
// service worker (src/sw/worker.ts) installs the new version in the
// background, and it waits there. This tells the page, which offers a reload;
// only that click lets the new version take over and reloads the page. Nothing
// here reloads by itself, so a deploy never interrupts a debate.

/** The message that lets a waiting version take over; the worker knows it too. */
export const SKIP_WAITING = 'skip-waiting';

/** The parts of a `ServiceWorker` used here. */
export interface WorkerLike {
  readonly state: ServiceWorkerState;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
  removeEventListener(type: 'statechange', listener: () => void): void;
}

/** The parts of a `ServiceWorkerRegistration` used here. */
export interface RegistrationLike {
  readonly installing: WorkerLike | null;
  readonly waiting: WorkerLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
  removeEventListener(type: 'updatefound', listener: () => void): void;
}

/** The parts of `navigator.serviceWorker` used here. */
export interface ContainerLike {
  /** The version this page runs on; null on the first visit. */
  readonly controller: object | null;
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

export interface Updates {
  /** For `useSyncExternalStore`: called when `ready()` changes. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Whether a new version is installed and waiting for the reload. */
  readonly ready: () => boolean;
  /** The teacher's click: let the new version take over, then reload. */
  readonly apply: () => void;
  /** Follow a registration; returns a function that stops following it. */
  readonly watch: (registration: RegistrationLike, container: ContainerLike) => () => void;
}

export function createUpdates(reload: () => void = () => window.location.reload()): Updates {
  const listeners = new Set<() => void>();
  let waiting: WorkerLike | null = null;
  let container: ContainerLike | null = null;
  let applying = false;

  const watch = (registration: RegistrationLike, serviceWorker: ContainerLike) => {
    container = serviceWorker;
    // A version that waits while this page runs on an older one. On the first
    // visit there is no older one, and the first version takes over at once.
    const offer = (worker: WorkerLike | null) => {
      if (worker === null || worker === waiting) return;
      if (worker.state !== 'installed' || serviceWorker.controller === null) return;
      waiting = worker;
      for (const listener of listeners) listener();
    };

    let installing: WorkerLike | null = null;
    const onStateChange = () => offer(installing);
    const onUpdateFound = () => {
      installing?.removeEventListener('statechange', onStateChange);
      installing = registration.installing;
      installing?.addEventListener('statechange', onStateChange);
    };

    // Found on an earlier visit, or while this page loaded.
    offer(registration.waiting);
    onUpdateFound();
    registration.addEventListener('updatefound', onUpdateFound);
    return () => {
      registration.removeEventListener('updatefound', onUpdateFound);
      installing?.removeEventListener('statechange', onStateChange);
    };
  };

  const apply = () => {
    if (waiting === null || container === null || applying) return;
    applying = true;
    if (waiting.state === 'installed') {
      // It takes over, and the page reloads once it has.
      container.addEventListener('controllerchange', () => reload());
      waiting.postMessage({ type: SKIP_WAITING });
    } else {
      // It took over already, from another tab: only the reload is left.
      reload();
    }
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ready: () => waiting !== null,
    apply,
    watch,
  };
}

/** The app's own: the page follows its service worker with it (register.ts). */
export const appUpdates = createUpdates();
