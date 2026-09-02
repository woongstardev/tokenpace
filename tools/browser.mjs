/**
 * browser.mjs — the bits of "drive a headless Chrome over CDP" that both
 * tools/check-a11y.mjs and tools/capture.mjs need.
 *
 * Chrome is driven over CDP directly rather than through a driver library: the
 * whole interaction is "navigate, evaluate, read the result", and a
 * headless-browser dependency would be larger than the site it inspects.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { REPO_ROOT } from './corpus-config.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll until a condition holds, or give up.
 *
 * Everything that waits here used to be a fixed sleep. That passed locally and
 * failed on a CI runner where Chrome took a moment longer to open its debug
 * port — the classic shape of a flaky test. Nothing waits on a guess any more.
 */
export async function until(describe, check, { timeoutMs = 20_000, intervalMs = 150, failFast } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (err) {
      // Some failures will never become successes — a dead browser will not
      // start answering. Waiting the full timeout on those turns a clear
      // diagnosis into a vague one.
      if (failFast?.(err)) throw err;
      lastError = err;
    }
    await sleep(intervalMs);
  }
  throw new Error(`timed out waiting for ${describe}${lastError ? ` (${lastError.message})` : ''}`);
}

/** Playwright's cached Chromium, whatever build number it happens to be on. */
async function playwrightChromium() {
  const root = path.join(process.env.HOME ?? '', '.cache', 'ms-playwright');
  let entries;
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.startsWith('chromium-'))
    .sort()
    .reverse()
    .flatMap((name) => [
      path.join(root, name, 'chrome-linux64', 'chrome'),
      path.join(root, name, 'chrome-linux', 'chrome'),
    ]);
}

export async function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    ...(await playwrightChromium()),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  throw new Error(
    `no Chrome found. Set CHROME=/path/to/chrome. Tried:\n  ${candidates.join('\n  ')}`
  );
}

/** Serve the repository as the deployed site would: static files, no rewriting. */
export async function serveRepo(port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let file = path.join(REPO_ROOT, decodeURIComponent(url.pathname));
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return server;
}

/** Minimal CDP client: send a command, await its reply. */
async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const messageId = ++id;
      pending.set(messageId, resolve);
      socket.send(JSON.stringify({ id: messageId, method, params }));
    });

  const evaluate = async (expression) => {
    const { result } = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result?.result?.value;
  };

  return { send, evaluate, close: () => socket.close() };
}

/**
 * Launch a throwaway Chrome, hand `fn` a connected tab, and always clean up.
 *
 * Each caller passes its own `debugPort`: a killed Chrome can hold a port for a
 * moment, and reusing one turns that into an intermittent CI failure.
 */
export async function withChrome({ chromePath, debugPort, reducedMotion = false }, fn) {
  const args = [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank',
  ];
  if (reducedMotion) args.push('--force-prefers-reduced-motion');

  // stderr is kept, not discarded: when Chrome refuses to start it says why
  // there, and without it the only symptom is a timeout that reads identically
  // to a slow machine.
  const chrome = spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  chrome.stderr?.on('data', (chunk) => { stderr += chunk; });
  let exited = null;
  chrome.on('exit', (code, signal) => { exited = signal ? `signal ${signal}` : `exit code ${code}`; });

  try {
    // 60s, not 20s: a cold GitHub runner has taken longer than 20s to open the
    // port, and the resulting red build says nothing about the project. A long
    // ceiling costs nothing when the wait is a poll — it returns as soon as
    // Chrome is up — and a Chrome that dies is caught below in milliseconds
    // rather than waited out.
    await until(
      `Chrome to open its debug port (${debugPort})`,
      async () => {
        if (exited) {
          throw new Error(
            `Chrome exited (${exited}) before opening its debug port` +
              `${stderr.trim() ? `: ${stderr.trim().split('\n').slice(-3).join(' / ')}` : ''}`
          );
        }
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
        return res.ok;
      },
      { timeoutMs: 60_000, failFast: (err) => err.message.startsWith('Chrome exited') }
    );
    const tab = await (
      await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })
    ).json();
    const cdp = await connect(tab.webSocketDebuggerUrl);
    try {
      await cdp.send('Runtime.enable');
      await cdp.send('Page.enable');
      return await fn(cdp);
    } finally {
      cdp.close();
    }
  } finally {
    chrome.kill();
  }
}
