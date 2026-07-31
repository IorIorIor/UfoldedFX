# Project notes for Claude

- Always push every commit to `main` as well as the working branch
  (`git push origin HEAD:main`). The repo owner has granted standing
  permission for this — no need to ask.
- `index.html` itself must stay a single self-contained file (no build step,
  no dependencies) that runs from `file://` and inside an Android WebView —
  WebGL 1 only, no required external requests. `server.js` is an additive,
  zero-dependency Node server (core modules only) that serves that same
  `index.html` plus a `/api/presets` JSON endpoint for cross-device Saved
  Settings persistence on Railway. Any feature that talks to `/api/presets`
  must degrade gracefully (fall back to `localStorage`) when no server is
  present, so the page still works opened directly from disk.
- Verify rendering changes headlessly before pushing: Playwright with the
  pre-installed Chromium (`executablePath: '/opt/pw-browsers/chromium'`,
  `--use-gl=swiftshader --enable-unsafe-swiftshader`), screenshot the Aura
  and Sliced presets, and check the `#err` box is empty.
