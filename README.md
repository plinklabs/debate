# Debate — by Plink Labs

A small web app for running a debate in class: topics, teams, timed turns and an
audience vote. It runs entirely in the browser — no accounts, no server, and student
names never leave the device.

**Live:** https://plinklabs.org/debate/

## Development

Requires Node 22.

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (Vitest)
npm run build    # type-check and build to dist/
```

Every push to `main` is built and deployed to GitHub Pages by
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). Pull requests run the
same checks without deploying.

The look follows the [Plink Labs design system](https://github.com/plinklabs/plink-design-system);
its tokens are vendored in `src/styles/plink/`.

## License

Code: GPL-3.0 — see [LICENSE](LICENSE).
The Plink Labs name and logo are not covered by the GPL and remain reserved trademarks.
