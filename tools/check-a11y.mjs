#!/usr/bin/env node
/**
 * check-a11y.mjs — run axe against the real page, in the states that matter.
 *
 *   node tools/check-a11y.mjs
 *   CHROME=/path/to/chrome node tools/check-a11y.mjs
 *
 * The project claims accessibility as a differentiator — a page whose entire
 * content is a moving animation has to. A claim that is not checked is a claim
 * that quietly stops being true, so this runs in CI.
 *
 * Chrome is driven over CDP directly rather than through a driver library:
 * the whole interaction is "navigate, evaluate, read the result", and a
 * headless-browser dependency would be larger than the site.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { REPO_ROOT } from './corpus-config.mjs';

const PORT = 8791;
const DEBUG_PORT = 9351;

const CHROME_CANDIDATES = [
  process.env.CHROME,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
].filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The states a real visitor arrives in. Each gets its own audit. */
const SCENARIOS = [
  { name: 'default (ko, light)', url: '/', emulate: {} },
  { name: 'english, dark', url: '/?lang=en&theme=dark', emulate: {} },
  { name: 'reduced motion', url: '/', emulate: { reducedMotion: 'reduce' } },
  { name: 'mobile 390px', url: '/', emulate: { width: 390, height: 844, mobile: true } },
];

async function serve() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
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
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  return server;
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  throw new Error(
    `no Chrome found. Set CHROME=/path/to/chrome. Tried:\n  ${CHROME_CANDIDATES.join('\n  ')}`
  );
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

async function auditScenario(chromePath, axeSource, scenario) {
  const args = [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    'about:blank',
  ];
  if (scenario.emulate.reducedMotion) args.push('--force-prefers-reduced-motion');

  const chrome = spawn(chromePath, args, { stdio: 'ignore' });
  try {
    await sleep(2200);
    const tab = await (
      await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' })
    ).json();
    const cdp = await connect(tab.webSocketDebuggerUrl);

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    if (scenario.emulate.width) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: scenario.emulate.width,
        height: scenario.emulate.height,
        deviceScaleFactor: 2,
        mobile: !!scenario.emulate.mobile,
      });
    }
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}${scenario.url}` });
    await sleep(1800);

    await cdp.evaluate(axeSource);
    const results = await cdp.evaluate(
      `axe.run(document, { resultTypes: ['violations'] })
         .then(r => JSON.stringify(r.violations.map(v => ({
            id: v.id, impact: v.impact, help: v.help,
            nodes: v.nodes.slice(0, 3).map(n => n.target.join(' '))
         }))))`
    );

    // Horizontal overflow is not an axe rule but it is the most common way a
    // page becomes unusable on a phone, so check it in the same pass.
    const overflow = await cdp.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth'
    );

    cdp.close();
    return { violations: JSON.parse(results), overflow };
  } finally {
    chrome.kill();
    await sleep(400);
  }
}

async function main() {
  const chromePath = await findChrome();
  const axeSource = await readFile(
    path.join(REPO_ROOT, 'tools', 'node_modules', 'axe-core', 'axe.min.js'),
    'utf8'
  );
  const server = await serve();

  console.log(`Auditing with axe-core, ${path.basename(chromePath)}\n`);
  let problems = 0;

  try {
    for (const scenario of SCENARIOS) {
      const { violations, overflow } = await auditScenario(chromePath, axeSource, scenario);

      if (!violations.length && overflow <= 0) {
        console.log(`  ok   ${scenario.name}`);
        continue;
      }
      console.log(`  FAIL ${scenario.name}`);
      for (const v of violations) {
        problems++;
        console.log(`         [${v.impact}] ${v.id} — ${v.help}`);
        for (const target of v.nodes) console.log(`           ${target}`);
      }
      if (overflow > 0) {
        problems++;
        console.log(`         page scrolls horizontally by ${overflow}px`);
      }
    }
  } finally {
    server.close();
  }

  if (problems) {
    console.error(`\n${problems} accessibility problem(s).`);
    process.exit(1);
  }
  console.log('\nNo violations.');
}

main().catch((err) => {
  console.error(`\ncheck-a11y failed: ${err.message}`);
  process.exit(1);
});
