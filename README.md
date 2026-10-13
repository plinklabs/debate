# Debate — by Plink Labs

A small web app for running a debate in class: topics, teams, timed turns and an
audience vote. It runs entirely in the browser — no accounts, no server, and student
names never leave the device.

**Live:** https://plinklabs.org/debate/

## Offline use and updates

After one visit, the app works without a network: a service worker keeps every file of
the app in the browser, so it loads, runs a whole debate and makes its report offline.
It can also be installed as an app (Chrome: _Install_ in the address bar). Nothing is
fetched from other sites.

A new version, once deployed, is downloaded in the background the next time the app is
opened, or within the hour on a page left open. The app then shows _A new version is
ready_ with a **Reload** button. It never reloads by itself, so a debate is never
interrupted; after the reload, debates in progress are kept, with their clocks paused.

How it is built: `src/sw/worker.ts` is the worker (type-checked with `tsconfig.sw.json`,
as it runs in a worker, not a window). The Vite plugin in `tools/serviceWorker.ts` turns
it into `dist/sw.js` with the list of the build's files in front of it, so every deploy
that changes a file is a new version. The page registers it, in production builds only,
with the scope `/debate/` (`src/offline/register.ts`); the rest of `plinklabs.org` is
another site, and the worker touches neither its paths nor its caches. The web app
manifest and the icons are in `public/`; the PNG icons are the Plink mark
(`public/plink-mark.svg`) on paper, rendered once with Playwright.

## Development

Requires Node 22 (22.13 or later).

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check and build to dist/
npm run preview  # serve the build at http://localhost:4173/debate/
```

Every push to `main` is built and deployed to GitHub Pages by
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). Pull requests run the
same checks without deploying.

The look follows the [Plink Labs design system](https://github.com/plinklabs/plink-design-system);
its tokens are vendored in `src/styles/plink/`.

## Checks

Every change must pass these. CI runs them in this order:

| Command                | What it checks                                                              |
| ---------------------- | --------------------------------------------------------------------------- |
| `npm run format:check` | Prettier formatting (`npm run format` fixes it)                             |
| `npm run lint`         | oxlint: correctness, TypeScript, React and react-hooks rules; warnings fail |
| `npm run typecheck`    | `tsc` over the app, the service worker, and the Playwright config and tests |
| `npm test`             | Unit and component tests (Vitest, jsdom, React Testing Library)             |
| `npm run build`        | Type-check and production build to `dist/`                                  |
| `npm run e2e`          | End-to-end tests (Playwright, Chromium, desktop and phone size)             |

- **Unit and component tests** sit next to the code as `src/**/*.test.{ts,tsx}`. The
  jest-dom matchers are set up in `src/test/setup.ts`. The debate model in `src/model/`
  has no React or DOM, so its tests run in plain Node (`// @vitest-environment node`).
- **End-to-end tests** live in `e2e/*.spec.ts` and run against the production build,
  served by `vite preview` under the `/debate/` base path. Use relative URLs
  (`page.goto('./')`) so they resolve under `/debate/`. Install the browser once with
  `npx playwright install chromium`. Locally, `npm run e2e` builds first and then serves
  `dist/` on port 4173 (a server already running there is reused); in CI it serves the
  build from the previous step. When e2e fails in CI, the Playwright report is uploaded as
  the `playwright-report` artifact; locally, open it with `npx playwright show-report`.
  Checks shared by the specs live in `e2e/helpers.ts` (not a spec, so Playwright doesn't
  run it): `expectFits(page)` fails on sideways scrolling or rendered text under 16px.
  The build registers its service worker, so after the first load a page is served from
  the worker's cache, which `page.route()` does not see; each test has a fresh browser
  context, so nothing is cached from one test to the next.
- **Config:** `.prettierrc.json`, `.oxlintrc.json`, `tsconfig.json` (app),
  `tsconfig.node.json` (Playwright) and `tsconfig.sw.json` (service worker),
  `vite.config.ts` (build and Vitest), `playwright.config.ts`.
- The linter is oxlint rather than ESLint because typescript-eslint needs the TypeScript
  compiler API, which the native TypeScript 7 compiler does not provide.
- The vendored tokens in `src/styles/plink/` are left out of formatting and linting.

## Languages

The UI is in English and Dutch. Every UI string lives in a dictionary,
`src/i18n/en.ts` and `src/i18n/nl.ts`; English sets the keys, so a key missing from
either one fails the type check. Components read them with `useI18n()` from `src/i18n/`,
which also formats numbers and durations in the current language. The language comes from
the browser, can be switched in the header, and is remembered in `localStorage` under
`plinklabs:debate:language`, apart from the debate itself.

## License

Code: GPL-3.0 — see [LICENSE](LICENSE).
The Plink Labs name and logo are not covered by the GPL and remain reserved trademarks.
