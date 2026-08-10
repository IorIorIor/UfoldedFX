#!/usr/bin/env node
'use strict';

// Builds android/heart-view.html — a UI-less, self-contained viewer of the
// aura-heart shader that exposes a tiny JS API (window.HeartFX) for an
// Android WebView to drive animated transitions between baked-in states.
//
// The shader sources, heart geometry, and core lookup-table builders are
// extracted VERBATIM from ../index.html, so re-running this script after
// changing the main app keeps the viewer's rendering identical.
//
// Usage:  node build-viewer.js
// Inputs: ../index.html, ./states.json
// Output: ./heart-view.html

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const states = JSON.parse(fs.readFileSync(path.join(__dirname, 'states.json'), 'utf8'));

function extract(re, label) {
  const m = src.match(re);
  if (!m) throw new Error('could not extract ' + label);
  return m[0];
}

const VERT = extract(/const VERT = `[\s\S]*?`;/, 'VERT');
const FRAG = extract(/const FRAG = `[\s\S]*?`;/, 'FRAG');
const HEART_PTS = extract(/const HEART_PTS = \[[^\]]*\];/, 'HEART_PTS');
const BUILD_SDF = extract(/function buildSdfTexture\(\)\{[\s\S]*?\n\}/, 'buildSdfTexture');
const BUILD_RAD = extract(/function buildRadialTexture\(\)\{[\s\S]*?\n\}/, 'buildRadialTexture');
const COMPUTE_RAMP = extract(/function computeRamp\(stops, soft\)\{[\s\S]*?\n\}/, 'computeRamp');

// derive the default parameter values from the main app's GROUPS/COLORS
const groupsSrc = extract(/const GROUPS = \[[\s\S]*?\n\];/, 'GROUPS');
const colorsSrc = extract(/const COLORS = \[[\s\S]*?\n\];/, 'COLORS');
const GROUPS = eval(groupsSrc.replace('const GROUPS =', '(').replace(/;\s*$/, ')')); // eslint-disable-line no-eval
const COLORS = eval(colorsSrc.replace('const COLORS =', '(').replace(/;\s*$/, ')')); // eslint-disable-line no-eval
const DEFAULTS = {};
for (const [, items] of GROUPS) for (const [key, , , , , def] of items) DEFAULTS[key] = def;
for (const [key, , def] of COLORS) DEFAULTS[key] = def;
const DEFAULT_STOPS = extract(/const DEFAULT_STOPS = \[[\s\S]*?\n\];/, 'DEFAULT_STOPS');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HeartFX viewer</title>
<style>
  * { margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; background: #14081f; }
  #glcanvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
  #err { position: fixed; left: 8px; bottom: 8px; color: #ff8080; font: 11px monospace; white-space: pre-wrap; }
</style>
</head>
<body>
<canvas id="glcanvas"></canvas>
<div id="err"></div>
<script>
'use strict';

// ---- baked states (regenerate with build-viewer.js after editing states.json)
const STATES = ${JSON.stringify(states, null, 2)};
const DEFAULTS = ${JSON.stringify(DEFAULTS)};
${DEFAULT_STOPS}

${HEART_PTS}

${VERT}

${FRAG}

// ---------------------------------------------------------------- gl setup
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl', { antialias: false })
        || canvas.getContext('experimental-webgl', { antialias: false });
const errBox = document.getElementById('err');
if (!gl) errBox.textContent = 'WebGL is not available in this WebView.';

function compile(type, srcText){
  const s = gl.createShader(type);
  gl.shaderSource(s, srcText);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

let prog;
try {
  prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
} catch (e) {
  errBox.textContent = 'Shader error:\\n' + e.message;
  throw e;
}

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, 'a_pos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const loc = {};
function u(name){ return loc[name] || (loc[name] = gl.getUniformLocation(prog, name)); }

// ---------------------------------------------------------------- helpers
function hexToRgb(hex){
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
function rgbToHex(rgb){
  return '#' + rgb.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
}
function lerpHex(a, b, t){
  const ra = hexToRgb(a), rb = hexToRgb(b);
  return rgbToHex([ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t]);
}
function easeInOutCubic(t){ return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function smoothstepJs(a, b, x){
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------- state
const first = STATES[0] || { state: {}, gradStops: null };
const state = { ...DEFAULTS, ...(first.state || {}) };
let gradStops = (first.gradStops && first.gradStops.length >= 2)
  ? first.gradStops.map(s => ({ ...s }))
  : DEFAULT_STOPS.map(s => ({ ...s }));
function setParam(k, v){ state[k] = v; }

// ---------------------------------------------------------------- textures
${BUILD_SDF}
buildSdfTexture();
gl.uniform1i(gl.getUniformLocation(prog, 'u_sdf'), 1);

${BUILD_RAD}
buildRadialTexture();
gl.uniform1i(gl.getUniformLocation(prog, 'u_rad'), 2);

${COMPUTE_RAMP}

let gradTex = null, lastRamp = null, bakedSoft = -1, glowOverride = null;
function uploadRamp(arr){
  lastRamp = arr;
  if (!gradTex) gradTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, gradTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(arr.buffer));
  gl.activeTexture(gl.TEXTURE0);
}
function bakeGradient(){
  bakedSoft = state.soft;
  uploadRamp(computeRamp(gradStops, state.soft));
}
gl.uniform1i(u('u_grad'), 3);
bakeGradient();

// ------------------------------------------------- animation phase clocks
let pulsePhase = 0, spinPhase = 0, huePhase = 0, driftPhase = 0;
let lastTick = performance.now();
let paused = false, t0 = performance.now(), timeAcc = 0;

function wrapAngle(a){ return Math.atan2(Math.sin(a), Math.cos(a)); }

function advancePhases(){
  const now = performance.now();
  const dt = Math.min((now - lastTick) / 1000, 0.1);
  lastTick = now;
  if (paused) return;
  pulsePhase = (pulsePhase + state.pulseSpeed * dt) % 1000;
  driftPhase = (driftPhase + state.drift * dt) % 1000;
  spinPhase += state.spin * dt;
  huePhase += state.hueCycle * 2.0 * dt;
  if (Math.abs(state.spin) < 0.001) spinPhase -= wrapAngle(spinPhase) * Math.min(3 * dt, 1);
  if (Math.abs(state.hueCycle) < 0.001) huePhase -= wrapAngle(huePhase) * Math.min(3 * dt, 1);
}

// ---------------------------------------------------------------- tween
let tweenToken = 0;

function animateToState(p, duration){
  duration = duration || 1400;
  const myToken = ++tweenToken;
  const fromState = { ...state };
  const toStateSrc = p.state || {};
  const numericKeys = [], hexKeys = [];
  for (const k in fromState){
    if (!(k in toStateSrc)) continue;
    if (typeof fromState[k] === 'number' && typeof toStateSrc[k] === 'number') numericKeys.push(k);
    else if (typeof fromState[k] === 'string' && typeof toStateSrc[k] === 'string') hexKeys.push(k);
  }

  const hasGrad = Array.isArray(p.gradStops) && p.gradStops.length >= 2 && lastRamp;
  let fromRamp, toStops, fromGlow, toGlow;
  if (hasGrad){
    fromRamp = lastRamp.slice();
    toStops = p.gradStops.map(s => ({ ...s }));
    const cur = glowOverride || [gradStops[gradStops.length - 2].p, gradStops[gradStops.length - 1].p];
    fromGlow = [cur[0], cur[1]];
    toGlow = [toStops[toStops.length - 2].p, toStops[toStops.length - 1].p];
  }

  const start = performance.now();
  function step(now){
    if (myToken !== tweenToken) return;
    const t = Math.min(1, (now - start) / duration);
    const e = easeInOutCubic(t);

    for (const k of numericKeys) setParam(k, fromState[k] + (toStateSrc[k] - fromState[k]) * e);
    for (const k of hexKeys) setParam(k, lerpHex(fromState[k], toStateSrc[k], e));

    if (hasGrad){
      const toRamp = computeRamp(toStops, state.soft);
      const blended = new Uint8ClampedArray(fromRamp.length);
      for (let i = 0; i < blended.length; i++) blended[i] = fromRamp[i] + (toRamp[i] - fromRamp[i]) * e;
      uploadRamp(blended);
      bakedSoft = state.soft;
      glowOverride = [
        fromGlow[0] + (toGlow[0] - fromGlow[0]) * e,
        fromGlow[1] + (toGlow[1] - fromGlow[1]) * e,
      ];
    }

    if (t < 1){
      requestAnimationFrame(step);
    } else if (hasGrad){
      gradStops = toStops;
      glowOverride = null;
      bakeGradient();
    }
  }
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------- draw
function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h){
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
}
window.addEventListener('resize', resize);
resize();

function drawScene(){
  resize();
  if (state.soft !== bakedSoft) bakeGradient();
  const t = (paused ? timeAcc : timeAcc + (performance.now() - t0) / 1000) % 3600;
  gl.uniform2f(u('u_res'), canvas.width, canvas.height);
  gl.uniform1f(u('u_time'), t);
  gl.uniform1f(u('u_pulsePhase'), pulsePhase);
  gl.uniform1f(u('u_spinPhase'), spinPhase);
  gl.uniform1f(u('u_huePhase'), huePhase);
  gl.uniform1f(u('u_driftPhase'), driftPhase);
  const ga = glowOverride || [gradStops[gradStops.length - 2].p, gradStops[gradStops.length - 1].p];
  gl.uniform1f(u('u_glowU0'), ga[0]);
  gl.uniform1f(u('u_glowU1'), ga[1]);
  for (const k in state){
    const v = state[k];
    if (k === 'sliceSpace'){
      gl.uniform1f(u('u_sliceSpaceFrac'), v / 100);
      continue;
    }
    if (typeof v === 'number') gl.uniform1f(u('u_' + k), v);
    else gl.uniform3fv(u('u_' + k), hexToRgb(v));
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function frame(){
  advancePhases();
  drawScene();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- API
// Called from Android via WebView.evaluateJavascript(), e.g.
//   webView.evaluateJavascript("HeartFX.setState('NEW REVEAL')", null);
window.HeartFX = {
  states(){ return STATES.map(s => s.name); },
  setState(name, durationMs){
    const p = STATES.find(s => s.name === name);
    if (!p) return false;
    animateToState(p, durationMs);
    return true;
  },
  jumpState(name){
    const p = STATES.find(s => s.name === name);
    if (!p) return false;
    tweenToken++; // cancel any running tween
    for (const k in (p.state || {})) setParam(k, p.state[k]);
    if (Array.isArray(p.gradStops) && p.gradStops.length >= 2){
      gradStops = p.gradStops.map(s => ({ ...s }));
      glowOverride = null;
      bakeGradient();
    }
    return true;
  },
  pause(){
    if (paused) return;
    timeAcc += (performance.now() - t0) / 1000;
    paused = true;
  },
  resume(){
    if (!paused) return;
    t0 = performance.now();
    paused = false;
  },
};

// boot into IDLE when present, else the first state
const idle = STATES.find(s => s.name === 'IDLE');
if (idle) window.HeartFX.jumpState('IDLE');
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'heart-view.html'), html);
console.log('wrote heart-view.html (' + html.length + ' bytes, ' + states.length + ' states: ' +
  states.map(s => s.name).join(', ') + ')');
