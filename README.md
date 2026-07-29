# UfoldedFX

A WebGL shader playground that renders a layered "aura heart" gradient — concentric
soft-blurred heart rings with a glowing halo — plus a glitchy vertical-slice variant.
Everything is driven by sliders.

## Run it

The whole app is a single dependency-free file. Either open `index.html` directly in a
browser, or serve it:

```sh
npx serve .
```

## Controls

- **Presets**: `Aura` (clean layered heart) and `Sliced` (vertical-strip glitch), plus
  `Random` and `Reset`.
- **Heart Shape**: size, position, width/height stretch, rotation, roundness.
- **Color Bands**: band spread/shift/curve, blur, glow amount and reach, plus a color
  picker for every ring, the glow, and the background.
- **Animation**: pulse speed/depth, sine-to-heartbeat shape, beat punch, spin, hue cycle.
- **Glitch Slices**: slice mix, count, x/y shift, stretch, seed, edge shading, drift.
- **Post FX**: chromatic aberration, grain, vignette, brightness, contrast, saturation.

`Save PNG` exports the current frame.

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
