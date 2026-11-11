// Usage: node components/demo/browser.test.mjs <path-to-cdp.mjs> [screenshot-directory]
// Drives a real local Chromium browser. No account or external application access.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const { Browser, sleep } = await import(pathToFileURL(resolve(process.argv[2])).href);
const out = resolve(process.argv[3] || join(tmpdir(), 'voicela-demo-qa'));
mkdirSync(out, { recursive: true });
const browser = await Browser.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/demo');
  assert.equal(await page.eval(() => getComputedStyle(document.querySelector('.v-demo-workspace')).display), 'grid', 'Desktop styles must be loaded');
  const click = async label => {
    assert.equal(await page.eval(text => {
      const button = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === text);
      if (!button || button.disabled) return false;
      button.click(); return true;
    }, label), true, `Missing or disabled button: ${label}`);
    await sleep(80);
  };
  const pick = async name => {
    assert.equal(await page.eval(text => {
      const button = [...document.querySelectorAll('[aria-label="Demo scenarios"] button')].find(el => el.querySelector('strong')?.textContent === text);
      button?.click(); return !!button;
    }, name), true);
    await sleep(100);
  };
  const text = () => page.eval(() => document.body.innerText);
  const run = async () => { await click('Run simulation'); await sleep(2700); };
  await page.screenshot({ path: join(out, 'desktop.png'), format: 'png', fullPage: true });
  await run();
  await click('Open preview');
  assert.match(await text(), /Invoice INV-2026-104/);
  await pick('Draft and send');
  await run();
  assert.match(await text(), /Your approval needed/);
  assert.doesNotMatch(await text(), /Simulated send complete/);
  assert.equal(await page.eval(() => document.activeElement?.textContent), 'Approve simulated send');
  // Keyboard approval: native button behavior, not a synthetic click.
  await page.send('Page.bringToFront');
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(1300);
  assert.match(await text(), /Simulated send complete/);
  await pick('Schedule a meeting'); await run();
  assert.match(await text(), /Conflict found at 14:00/);
  assert.match(await text(), /Proposed · not yet added/);
  await page.screenshot({ path: join(out, 'approval.png'), format: 'png', fullPage: true });
  await click('Approve simulated event'); await sleep(1300);
  assert.match(await text(), /Added · simulated/);
  await pick('Screen context'); await run();
  assert.match(await text(), /16.7%/);
  await pick('Dictation & edit'); await run();
  await click('Apply simulated edit'); await sleep(1300);
  assert.match(await text(), /Edited · simulated/);
  await click('Undo edit');
  assert.match(await text(), /original simulated note is restored/);
  await pick('Find my document');
  await click('Find missing contract'); await run();
  assert.match(await text(), /No matching document/);
  await click('Reset and recover');
  await click('Find private payroll'); await run();
  assert.match(await text(), /Access denied/);
  await click('Reset and recover');
  await click('Run simulation'); await click('Cancel run'); await sleep(2700);
  assert.match(await text(), /Cancelled/);
  // Switching to G must cancel a running desktop task without simulating mobile actions.
  await pick('Draft and send');
  await click('Run simulation');
  await pick('Mobile assistant preview');
  await sleep(2800);
  assert.match(await text(), /Concept \/ Planned/);
  assert.match(await text(), /Static concept illustration/);
  assert.equal(await page.eval(() => document.querySelector('.v-demo-commandComposer')), null);
  assert.equal(await page.eval(() => document.querySelector('.v-demo-mobileConcept img')?.getAttribute('src')), '/images/mobile-assistant-preview.svg');
  await click('Try a desktop simulation');
  assert.equal(await page.eval(() => document.querySelector('.v-demo-audit ol')), null, 'G clears the prior action trail');
  await pick('Find my document');
  for (const width of [1440, 768, 390]) {
    await page.setViewport({ width, height: 900, dsf: 1 });
    await page.eval(() => window.scrollTo(0, 0));
    await sleep(200);
    assert.equal(await page.eval(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}`);
    await page.screenshot({ path: join(out, `viewport-${width}.png`), format: 'png', fullPage: true });
    for (const name of ['Find my document', 'Draft and send', 'Schedule a meeting', 'Screen context', 'Dictation & edit', 'Mobile assistant preview']) {
      await pick(name);
      assert.equal(await page.eval(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: overflow at ${width}`);
      if (name === 'Mobile assistant preview') {
        assert.equal(await page.eval(() => { const img = document.querySelector('.v-demo-mobileConcept img'); return img.complete && img.naturalWidth > 0; }), true);
        await page.screenshot({ path: join(out, `mobile-concept-${width}.png`), format: 'png', fullPage: true });
      } else {
        assert.equal(await page.eval(() => {
          const form = document.querySelector('.v-demo-commandComposer');
          const input = form.querySelector('input');
          const button = form.querySelector('button[type="submit"]');
          form.scrollIntoView({ block: 'center', behavior: 'instant' });
          input.focus();
          const a = input.getBoundingClientRect(), b = button.getBoundingClientRect();
          return form === form.parentElement.lastElementChild && !input.disabled && !button.disabled && document.activeElement === input && a.width >= 100 && b.height >= 40 && a.top >= 0 && b.bottom <= innerHeight && a.left >= 0 && b.right <= innerWidth;
        }), true, `${name}: bottom composer reachable at ${width}`);
      }
    }
    await pick('Find my document');
  }
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await run();
  assert.equal(await page.eval(() => [...document.querySelectorAll('[aria-hidden="true"]')].filter(el => el.querySelector('svg') && el.textContent === 'Voicela').every(el => getComputedStyle(el).animationName === 'none')), true);
  assert.deepEqual(page.consoleErrors, []);
  console.log('PASS: A–E, explicit keyboard approval, file errors, cancellation, undo, G static concept and cancellation, three widths with reachable bottom composers, reduced motion, no runtime errors.');
} finally { await browser.close(); }
