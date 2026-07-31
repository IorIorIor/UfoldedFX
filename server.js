#!/usr/bin/env node
'use strict';

// Zero-dependency static file server + tiny JSON API for the "Saved
// Settings" feature. index.html works standalone (see CLAUDE.md), so this
// server only adds optional cross-device persistence when deployed.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Point DATA_DIR at a Railway Volume mount (e.g. /data) so presets.json
// survives redeploys; without one, it lives next to the app and resets
// whenever the container image is rebuilt.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'presets.json');
const INDEX_FILE = path.join(__dirname, 'index.html');
const MAX_BODY = 2 * 1024 * 1024; // 2MB safety cap

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

function readPresets() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/presets' && req.method === 'GET') {
    return sendJson(res, 200, readPresets());
  }

  if (req.url === '/api/presets' && req.method === 'POST') {
    let body = '';
    let size = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        aborted = true;
        sendJson(res, 413, { error: 'Payload too large' });
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (aborted) return;
      let list;
      try {
        list = JSON.parse(body);
      } catch (e) {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
      if (!Array.isArray(list)) return sendJson(res, 400, { error: 'Expected an array' });
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(list));
      } catch (e) {
        return sendJson(res, 500, { error: 'Could not save presets' });
      }
      sendJson(res, 200, list);
    });
    return;
  }

  fs.readFile(INDEX_FILE, (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end('Could not load index.html');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`UfoldedFX listening on port ${PORT} (data dir: ${DATA_DIR})`);
});
