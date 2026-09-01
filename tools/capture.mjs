#!/usr/bin/env node
/**
 * capture.mjs — screenshot the real page, in the states worth showing.
 *
 *   node tools/capture.mjs                       # writes the committed images
 *   node tools/capture.mjs --out /tmp/shots      # writes everything elsewhere
 *   CHROME=/path/to/chrome node tools/capture.mjs
 *
 * The README of a project that *is* a page has to show the page, and the social
 * card is a static asset we ship — docs/BRIEF.md §3 draws the line at a
 * committed PNG, no dynamic OG service. Both come from here rather than from
 * someone's desktop, so every image is regenerable and cannot quietly drift
 * from what the site actually looks like.
 *
 * Timing note: a screenshot of an animation is never byte-identical between
 * runs, so these images are not checked by CI the way the measurements are.
 * Each shot waits for a *state* (this many characters emitted) rather than for
 * a duration, which keeps the framing stable even though the pixels are not.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { REPO_ROOT } from './corpus-config.mjs';
import { findChrome, serveRepo, sleep, until, withChrome } from './browser.mjs';

const PORT = 8792;
const DEBUG_PORT_BASE = 9451;

/**
 * The shots. `settle` is how far into the stream to wait before capturing —
 * a character count, not a timestamp, so the framing survives a slow machine.
 */
const SHOTS = [
  {
    file: 'site-light.png',
    url: '/?tps=5,10,35&ttft=0.8&lang=ko&tok=o200k_base&theme=light',
    width: 1280,
    height: 1000,
    scale: 1,
    play: true,
    settle: 220,
  },
  {
    file: 'site-dark-en.png',
    url: '/?tps=5,10,35&ttft=0.8&lang=en&tok=o200k_base&theme=dark',
    width: 1280,
    height: 1000,
    scale: 1,
    play: true,
    settle: 220,
  },
  {
    file: 'site-mobile.png',
    url: '/?tps=5,35&ttft=0.8&lang=ko&tok=o200k_base&theme=light',
    width: 390,
    height: 844,
    mobile: true,
    play: true,
    settle: 120,
  },
  {
    file: 'site-reduced-motion.png',
    url: '/?tps=5,10,35&ttft=0.8&lang=ko&tok=o200k_base&theme=light',
    width: 1280,
    height: 1200,
    scale: 1,
    reducedMotion: true,
    scrollTo: '#lanes',
  },
  {
    // The social card — its own page (tools/og-card.html), not a crop of the
    // site: a crop carries neither the name nor the claim, and a card is mostly
    // read at thumbnail size. 1200×630 is what every crawler crops to; scale 1
    // keeps it at exactly that size instead of a 2× file nobody needs.
    file: 'og.png',
    committedTo: path.join(REPO_ROOT, 'assets', 'og.png'),
    url: '/tools/og-card.html',
    width: 1200,
    height: 630,
    scale: 1,
    readyWhen: 'document.documentElement.dataset.cardReady === "true"',
  },
];

async function capture(chromePath, shot, index) {
  return withChrome(
    { chromePath, debugPort: DEBUG_PORT_BASE + index, reducedMotion: !!shot.reducedMotion },
    async (cdp) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shot.width,
        height: shot.height,
        deviceScaleFactor: shot.scale ?? 2,
        mobile: !!shot.mobile,
      });
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}${shot.url}` });

      const ready =
        shot.readyWhen ?? 'document.querySelectorAll(".lane, table.timeline").length > 0';
      await until('the page to render', () => cdp.evaluate(ready));

      if (shot.play) {
        await cdp.evaluate('document.querySelector("#play").click()');
        // Wait on a character count, not a clock: same framing on any machine.
        await until(`${shot.settle} characters to stream`, () =>
          cdp.evaluate(
            `Math.max(0, ...[...document.querySelectorAll(".lane-text")]
               .map(n => n.textContent.length)) >= ${shot.settle}`
          )
        );
        // Same button stops the clock — freeze mid-stream so the capture is not
        // a moving target while the screenshot is being encoded.
        await cdp.evaluate('document.querySelector("#play").click()');
      }
      if (shot.scrollTo) {
        await cdp.evaluate(
          `document.querySelector(${JSON.stringify(shot.scrollTo)})
             .scrollIntoView({ block: 'start', behavior: 'instant' })`
        );
      }
      await sleep(200); // one paint, plus the scroll settling

      const { result } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      return Buffer.from(result.data, 'base64');
    }
  );
}

async function main() {
  const outFlag = process.argv.indexOf('--out');
  const overrideOut = outFlag !== -1;
  const outDir = overrideOut
    ? path.resolve(process.argv[outFlag + 1])
    : path.join(REPO_ROOT, 'docs', 'screenshots');

  const chromePath = await findChrome();
  await mkdir(outDir, { recursive: true });
  const server = await serveRepo(PORT);

  console.log(`Capturing with ${path.basename(chromePath)}\n`);
  try {
    for (const shot of SHOTS) {
      const png = await capture(chromePath, shot, SHOTS.indexOf(shot));
      const target =
        shot.committedTo && !overrideOut ? shot.committedTo : path.join(outDir, shot.file);
      await writeFile(target, png);
      console.log(
        `  ${path.relative(REPO_ROOT, target).padEnd(34)} ` +
          `${shot.width}×${shot.height}  ${(png.length / 1024).toFixed(0)} KB`
      );
    }
  } finally {
    server.close();
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(`\ncapture failed: ${err.message}`);
  process.exit(1);
});
