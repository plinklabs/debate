import { appUpdates } from './updates';

/** How often an open page asks whether a new version was deployed. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Register the service worker that keeps the app working offline (#9), once
 * the page has loaded, so it does not compete with the first visit. Its scope
 * is the app's own path, /debate/: the rest of the origin is another site.
 *
 * The browser looks for a new version each time the app is opened; a page left
 * open, on the projector all day, asks once an hour as well. A new version
 * shows the update notice, and waits for the teacher's click.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  const register = () => {
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then((registration) => {
        appUpdates.watch(registration, navigator.serviceWorker);
        window.setInterval(() => {
          // Offline, or the server is down: the next check will tell.
          registration.update().catch(() => {});
        }, CHECK_EVERY_MS);
      })
      .catch(() => {
        // Without a service worker, the app works as before: online.
      });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
