# Project notes for Claude

- Always push every commit to `main` as well as the working branch
  (`git push origin HEAD:main`). The repo owner has granted standing
  permission for this — no need to ask.
- The app is a single self-contained `index.html` (no build step, no
  dependencies). Keep it that way: it must run from `file://` and inside an
  Android WebView, so WebGL 1 only, no external requests.
- Verify rendering changes headlessly before pushing: Playwright with the
  pre-installed Chromium (`executablePath: '/opt/pw-browsers/chromium'`,
  `--use-gl=swiftshader --enable-unsafe-swiftshader`), screenshot the Aura
  and Sliced presets, and check the `#err` box is empty.
