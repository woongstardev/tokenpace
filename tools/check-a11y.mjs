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
 * The headless-Chrome plumbing lives in tools/browser.mjs, shared with
 * tools/capture.mjs.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { REPO_ROOT } from './corpus-config.mjs';
import { findChrome, serveRepo, sleep, until, withChrome } from './browser.mjs';

const PORT = 8791;
/** Each scenario gets its own debug port. A killed Chrome can hold its port for
 *  a moment, and reusing one turns that into an intermittent CI failure. */
const DEBUG_PORT_BASE = 9351;

/** The states a real visitor arrives in. Each gets its own audit. */
const SCENARIOS = [
  { name: 'default (ko, light)', url: '/', emulate: {} },
  { name: 'english, dark', url: '/?lang=en&theme=dark', emulate: {} },
  { name: 'reduced motion', url: '/', emulate: { reducedMotion: 'reduce' } },
  { name: 'mobile 390px', url: '/', emulate: { width: 390, height: 844, mobile: true } },
];

async function auditScenario(chromePath, axeSource, scenario, index) {
  return withChrome(
    {
      chromePath,
      debugPort: DEBUG_PORT_BASE + index,
      reducedMotion: !!scenario.emulate.reducedMotion,
    },
    async (cdp) => {
      if (scenario.emulate.width) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: scenario.emulate.width,
          height: scenario.emulate.height,
          deviceScaleFactor: 2,
          mobile: !!scenario.emulate.mobile,
        });
      }
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}${scenario.url}` });

      // The page renders lanes (or, under reduced motion, a timeline table) as
      // soon as its module has run. Waiting for that beats waiting for a duration.
      await until('the page to finish rendering', () =>
        cdp.evaluate('document.querySelectorAll(".lane, table.timeline").length > 0')
      );

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

      return { violations: JSON.parse(results), overflow };
    }
  );
}

/**
 * How much speech does one gesture cost?
 *
 * axe checks the page as it stands still. It has no way to see how often a
 * live region changes, and that is where this page went wrong: the verdict
 * block carried aria-live and was re-rendered on every `input` event, so
 * dragging the TTFT slider for under two seconds replaced a 414-character
 * region 32 times — roughly thirteen thousand characters queued for one drag,
 * with axe reporting nothing. Announcements are a budget, so it is checked
 * like one.
 */
const DRAG_ANNOUNCEMENT_BUDGET = { count: 3, chars: 400 };

async function auditLiveRegions(chromePath) {
  return withChrome({ chromePath, debugPort: DEBUG_PORT_BASE + 90 }, async (cdp) => {
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?tps=5,10,35` });
    await until('the page to finish rendering', () =>
      cdp.evaluate('document.querySelectorAll(".lane, table.timeline").length > 0')
    );

    await cdp.evaluate(`
      window.__spoken = [];
      for (const r of document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')) {
        new MutationObserver(() => {
          const text = (r.textContent || '').replace(/\\s+/g, ' ').trim();
          if (text) window.__spoken.push(text.length);
        }).observe(r, { childList: true, subtree: true, characterData: true });
      }
      'ok'`);

    // A drag is many input events over a couple of seconds, not one jump.
    await cdp.evaluate(`
      (async () => {
        document.dispatchEvent(new Event('pointerdown'));
        const el = document.getElementById('ttft-input');
        for (let v = 0; v <= 30; v++) {
          el.value = (v / 10).toFixed(1);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 60));
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })(); 'started'`);
    await sleep(3200);

    const spoken = JSON.parse(await cdp.evaluate('JSON.stringify(window.__spoken)'));

    // And the animation must have an equivalent that does not depend on the
    // visitor having asked their OS to reduce motion.
    const toggled = JSON.parse(
      await cdp.evaluate(`
        document.getElementById('view-toggle').click();
        JSON.stringify({
          table: !!document.querySelector('table.timeline'),
          pressed: document.getElementById('view-toggle').getAttribute('aria-pressed'),
        })`)
    );

    return { spoken, toggled };
  });
}

async function main() {
  const chromePath = await findChrome();
  const axeSource = await readFile(
    path.join(REPO_ROOT, 'tools', 'node_modules', 'axe-core', 'axe.min.js'),
    'utf8'
  );
  const server = await serveRepo(PORT);

  console.log(`Auditing with axe-core, ${path.basename(chromePath)}\n`);
  let problems = 0;

  try {
    for (const scenario of SCENARIOS) {
      const { violations, overflow } = await auditScenario(
        chromePath,
        axeSource,
        scenario,
        SCENARIOS.indexOf(scenario)
      );

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

    const { spoken, toggled } = await auditLiveRegions(chromePath);
    const total = spoken.reduce((n, c) => n + c, 0);
    if (spoken.length > DRAG_ANNOUNCEMENT_BUDGET.count || total > DRAG_ANNOUNCEMENT_BUDGET.chars) {
      problems++;
      console.log('  FAIL live-region budget');
      console.log(
        `         one slider drag queued ${spoken.length} announcement(s), ${total} characters ` +
          `(budget ${DRAG_ANNOUNCEMENT_BUDGET.count} / ${DRAG_ANNOUNCEMENT_BUDGET.chars})`
      );
    } else {
      console.log(`  ok   live-region budget (${spoken.length} announcement(s), ${total} chars per drag)`);
    }

    if (!toggled.table || toggled.pressed !== 'true') {
      problems++;
      console.log('  FAIL the animation has no equivalent without prefers-reduced-motion');
    } else {
      console.log('  ok   the lanes can be read as a table without prefers-reduced-motion');
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
