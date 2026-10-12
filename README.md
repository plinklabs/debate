# Debate — by Plink Labs

A small web app for running a debate in class: topics, teams, timed turns and an
audience vote. It runs entirely in the browser — no accounts, no server, and student
names never leave the device.

**Live:** https://plinklabs.org/debate/

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
| `npm run typecheck`    | `tsc` over the app and over the Playwright config and tests                 |
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
- **Config:** `.prettierrc.json`, `.oxlintrc.json`, `tsconfig.json` (app) and
  `tsconfig.node.json` (Playwright), `vite.config.ts` (Vitest), `playwright.config.ts`.
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
