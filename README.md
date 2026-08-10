# UfoldedFX

A WebGL shader playground that renders a layered "aura heart" gradient — concentric
soft-blurred heart rings with a glowing halo — plus a glitchy vertical-slice variant.
Everything is driven by sliders.

## Run it

The app itself is still a single dependency-free `index.html` — open it directly in a
browser, or serve it:

```sh
npx serve .
```

For server-synced Saved States (see below), run the bundled zero-dependency Node
server instead:

```sh
node server.js
```

## Controls

Five sliders — size, band spread, blur, slice mix, space — sit unstyled in the top-right
corner and are always visible. The `All Settings` button beneath them expands the rest of
the controls directly underneath, in that same unstyled floating layout (no separate
boxed panel):

- **Heart Shape**: size (up to 5x — the heart can grow well past the frame), position,
  width/height stretch, rotation, roundness, and an
  `svg↔classic` blend. The default silhouette is a signed-distance field baked at startup
  from a polygon sampled off the reference heart SVG (embedded in the file — still zero
  external requests); `classic` is an analytic heart SDF.
- **Color Bands**: band spread/shift/curve, blur, glow amount and reach.
- **Gradient**: a full gradient editor drives the ring colors — drag stops along the bar
  to move band boundaries, click one to select it and change its color, double-click the
  bar (or `Add Stop`) to insert a stop, `Delete` to remove it. The gradient is baked into
  a 256x1 texture, so any number of stops costs the shader a single lookup. The last two
  stops anchor where the outer glow rises.
- **Animation**: pulse speed/depth, sine-to-heartbeat shape, beat punch, spin, hue cycle.
- **Glitch Slices**: a slice is a visible band of content; adjacent slices meet directly
  (never separated by dark bars) and are distinguished only by the discontinuity in what
  each one samples. `space` (0–100) is the width of each slice: near 0 the slices go
  hairline-thin and the fan warp reads as perfectly smooth ("no slices"); the default (~5)
  gives many fine slices; 50 gives a few big heart panels; 100 makes each slice half the
  screen wide (~2 slices). The grid is anchored on a slice centred in the middle of the
  screen, so it is always mirror-symmetric, and since every boundary position moves
  smoothly with the width value, dragging `space` (or animating it between saved states)
  sweeps the slices continuously outward from the centre. `slice mix` is the master
  on/off blend; `shift x` sets how far the fan displaces each slice's content; y shift,
  stretch, skew, perspective (folded-panel tilt with directional shading), randomness,
  seed, edge shading and drift remain independent advanced controls, each seeded from a
  slice's distance-rank from the centre so the pattern mirrors cleanly at any width.
  Per-slice detail fades out automatically as slices approach subpixel width, so tiny
  `space` values stay clean instead of noisy.
- **Post FX**: chromatic aberration, grain, vignette, brightness, contrast, saturation.

`Save PNG` exports the current frame.

## Saved States

`Save State` snapshots every slider, the gradient, and the glow color into a named entry
in the `States (N) ▾` dropdown. Click an entry's name and the whole scene animates there
over about 1.4s — every slider eases to its new value and the gradient crossfades to the
new colors — rather than snapping instantly. The pencil renames an entry inline, `✕`
deletes it. Clicking a different state mid-animation blends onward from wherever the
transition currently is, rather than restarting.

Persistence is layered so the feature works whether or not a server is present:

- If `server.js` is running (e.g. on Railway), saves sync to `GET`/`POST /api/presets`,
  which the server persists to a `presets.json` file — shared across every browser/device
  that opens the app.
- If there's no server (opened via `file://`, or the request fails), saves fall back to
  the browser's `localStorage` — still fully functional, just local to that browser.

## Deploying to Railway

The repo now includes `server.js` (Node core modules only, no npm dependencies) and a
`package.json` with a `start` script, so Railway's default Node builder needs no extra
configuration to run it — it detects `package.json`, runs `npm start`, and that runs
`node server.js`, which serves `index.html` and the `/api/presets` endpoint on
`process.env.PORT`.

The one thing to set up in the Railway dashboard is **persistent storage**, since a
Railway service's filesystem is ephemeral (wiped on every redeploy):

1. Open the service → **Settings → Volumes** → **New Volume**.
2. Mount it at `/data` (a small size is plenty — the presets file is a few KB).
3. Add an environment variable `DATA_DIR` = `/data`.
4. Redeploy.

Without a volume, saved settings still work, but reset to empty on every redeploy —
the app degrades gracefully to a fresh list rather than erroring.

## Android

The page is built to run inside an Android WebView with no changes:

- Single self-contained HTML file, no network requests — drop it into `app/src/main/assets/`.
- WebGL 1 only, with a `mediump` precision fallback and `sin`-free hashes that stay
  stable on mobile GPUs.
- Responsive layout: on narrow screens the control panel becomes a bottom sheet with
  touch-sized slider thumbs.

Minimal wiring in an Activity:

```kotlin
val webView = WebView(this)
webView.settings.javaScriptEnabled = true
webView.loadUrl("file:///android_asset/index.html")
setContentView(webView)
```
