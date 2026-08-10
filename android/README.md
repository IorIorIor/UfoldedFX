# HeartFX Android package

A UI-less build of the UfoldedFX aura-heart shader for embedding in an Android app
(e.g. as a live message-status background). It renders fullscreen in a WebView and
exposes a tiny JS API to animate between named, baked-in states:

`IDLE` · `TEXT MESSAGE` · `MEDIA MESSAGE` · `NEW REVEAL`

## Files

| file | purpose |
| --- | --- |
| `heart-view.html` | The deliverable. Fully self-contained (shader + states embedded), zero network requests, WebGL 1. Copy into `app/src/main/assets/`. |
| `states.json` | The named states baked into `heart-view.html`. **Currently placeholders** — see "Baking the real states". |
| `build-viewer.js` | Regenerates `heart-view.html` from `../index.html` + `states.json` (`node build-viewer.js`). Shader code and heart geometry are extracted verbatim from the main app, so rebuilding after main-app changes keeps rendering identical. |

## Baking the real states

The real TEXT MESSAGE / IDLE / MEDIA MESSAGE / NEW REVEAL states live in the
UfoldedFX Railway deployment. To bake them in:

```sh
curl https://<your-railway-app>/api/presets > states.json
node build-viewer.js
```

That endpoint returns exactly the format `states.json` expects (an array of
`{ id, name, state, gradStops }`). Entries in the current placeholder file are
marked `"_placeholder": true` so you can tell them apart from real data. The
viewer boots into the state named `IDLE` if present, else the first entry.

## Embedding in the APK

Copy `heart-view.html` to `app/src/main/assets/`, then:

```kotlin
val webView = WebView(this)
webView.settings.javaScriptEnabled = true
webView.setBackgroundColor(Color.TRANSPARENT)
webView.loadUrl("file:///android_asset/heart-view.html")
setContentView(webView)
```

- No `INTERNET` permission is needed — the page makes zero network requests.
- Hardware acceleration must be on (it is by default; don't set
  `LAYER_TYPE_SOFTWARE` on the WebView — WebGL requires the GPU path).
- The shader targets WebGL 1 with a `mediump` precision fallback and sin-free
  hashes, so it runs on old/low-end mobile GPUs.
- The canvas caps `devicePixelRatio` at 2 to keep fill-rate sane on high-density
  screens. For extra battery headroom on a persistent background, you can also
  fix the WebView's layout size smaller and let Android scale it up.

## Driving it from Kotlin/Java

```kotlin
webView.evaluateJavascript("HeartFX.setState('NEW REVEAL')", null)      // ~1.4s animated transition
webView.evaluateJavascript("HeartFX.setState('TEXT MESSAGE', 600)", null) // custom duration (ms)
webView.evaluateJavascript("HeartFX.jumpState('IDLE')", null)           // instant, no animation
webView.evaluateJavascript("HeartFX.pause()", null)                     // freeze all motion (offscreen)
webView.evaluateJavascript("HeartFX.resume()", null)
webView.evaluateJavascript("HeartFX.states()", { names -> /* JSON array */ })
```

`setState`/`jumpState` return `false` (in the evaluate callback) for unknown
names. Transitions interrupt cleanly: calling `setState` mid-animation blends
onward from whatever is currently on screen — every slider eases and the color
gradient crossfades pixel-wise, so rapid state changes (message bursts) always
look continuous. Call `pause()` in `onPause()`/when the view is offscreen and
`resume()` in `onResume()` to stop burning GPU while hidden.
