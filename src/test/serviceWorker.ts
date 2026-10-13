// A stand-in for a service worker registration and `navigator.serviceWorker`,
// which jsdom does not have, for the update notice (src/offline/updates.ts).
// It plays the browser's part: a deploy is found, installs and waits; a
// version takes over when it is told to, or from another tab.
import type { ContainerLike, RegistrationLike, WorkerLike } from '../offline/updates';

class Listeners {
  private readonly listeners = new Set<() => void>();
  add = (_type: string, listener: () => void) => {
    this.listeners.add(listener);
  };
  remove = (_type: string, listener: () => void) => {
    this.listeners.delete(listener);
  };
  fire() {
    for (const listener of [...this.listeners]) listener();
  }
}

export class FakeWorker implements WorkerLike {
  state: ServiceWorkerState = 'installing';
  /** What the page posted to this worker. */
  readonly messages: unknown[] = [];
  private readonly listeners = new Listeners();
  readonly addEventListener = this.listeners.add;
  readonly removeEventListener = this.listeners.remove;

  postMessage(message: unknown) {
    this.messages.push(message);
  }

  setState(state: ServiceWorkerState) {
    this.state = state;
    this.listeners.fire();
  }
}

export function fakeServiceWorker({ controlled = true }: { controlled?: boolean } = {}) {
  const found = new Listeners();
  const changed = new Listeners();

  const registration: RegistrationLike & {
    installing: FakeWorker | null;
    waiting: FakeWorker | null;
  } = {
    installing: null,
    waiting: null,
    addEventListener: found.add,
    removeEventListener: found.remove,
  };

  const container: ContainerLike & { controller: object | null } = {
    // A page opened before has a version in charge; the first visit has none.
    controller: controlled ? new FakeWorker() : null,
    addEventListener: changed.add,
  };

  /** A new version is found and starts to install. */
  const find = () => {
    const worker = new FakeWorker();
    registration.installing = worker;
    found.fire();
    return worker;
  };

  /** The version that was installing is installed, and waits. */
  const install = () => {
    const worker = registration.installing!;
    registration.installing = null;
    registration.waiting = worker;
    worker.setState('installed');
    return worker;
  };

  /** The waiting version takes over this page, as on skip-waiting or from another tab. */
  const takeOver = () => {
    const worker = registration.waiting!;
    registration.waiting = null;
    worker.setState('activated');
    container.controller = worker;
    changed.fire();
  };

  return {
    registration,
    container,
    find,
    install,
    takeOver,
    /** A new deploy, found and installed: it waits. */
    deploy: () => {
      find();
      return install();
    },
  };
}
