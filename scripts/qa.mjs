/**
 * TM-10 — the browser half of the release gate.
 *
 * Drives headless Chrome over the debugging protocol: every route answers, the
 * console stays clean, no width scrolls sideways, reduced motion arrives
 * finished, the whole check can be completed on the keyboard alone, and the
 * scheduling provider is not contacted until someone asks for it.
 *
 * Run a static server on the repository root first, then:
 *   node scripts/qa.mjs [http://127.0.0.1:4174]
 *
 * Exits non-zero on the first failed check.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import WS from './lib/ws.mjs';

const BASE = (process.argv[2] || 'http://127.0.0.1:4174').replace(/\/$/, '');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ROUTES = [
  '/',
  '/decisions/',
  '/decisions/raising-the-price-of-the-core-package/',
  '/research/'
];

/** The viewport matrix the specification requires. */
const VIEWPORTS = [
  [320, 720],
  [360, 800],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080]
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let failed = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function session({ reducedMotion = false } = {}) {
  const port = 9700 + Math.floor(Math.random() * 300);
  const flags = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    `--remote-debugging-port=${port}`,
    '--window-size=1280,900'
  ];
  if (reducedMotion) flags.push('--force-prefers-reduced-motion');
  const proc = spawn(CHROME, [...flags, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch {}
    await sleep(250);
  }
  if (!target) throw new Error('chrome did not start');
  const ws = new WS(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  const requests = [];
  ws.on('message', (raw) => {
    const message = JSON.parse(raw);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    if (message.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(message.params.exceptionDetails.text || 'exception');
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      consoleErrors.push(message.params.entry.text);
    }
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const next = ++id;
      pending.set(next, resolve);
      ws.send(JSON.stringify({ id: next, method, params }));
    });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Log.enable');
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.result?.exceptionDetails) {
      throw new Error(response.result.exceptionDetails.text);
    }
    return response.result?.result?.value;
  };
  const goto = async (path) => {
    await send('Page.navigate', { url: `${BASE}${path}` });
    await sleep(1800);
  };
  const resize = (width, height) =>
    send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  /**
   * A key press the page reacts to the way a person's would. Enter needs its
   * text payload, or the browser dispatches the event without performing the
   * default action, and a focused link never activates.
   */
  const press = async (keyName, code, keyCode) => {
    const base = { key: keyName, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
    if (keyName === 'Enter') {
      // the char event is what carries the default action to a focused link
      const cr = String.fromCharCode(13);
      await send('Input.dispatchKeyEvent', { type: 'char', ...base, text: cr, unmodifiedText: cr });
    }
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    await sleep(140);
  };
  const close = () => {
    ws.close();
    proc.kill();
  };
  return { evaluate, goto, resize, press, consoleErrors, requests, close, send };
}

/* ---------- 1. routes and console ---------- */

{
  const s = await session();
  for (const route of ROUTES) {
    await s.goto(route);
    const title = await s.evaluate('document.title');
    check(`route ${route} renders`, Boolean(title), title);
  }
  await s.goto('/');
  await s.evaluate('window.scrollTo(0, document.body.scrollHeight); "scrolled"');
  await sleep(600);
  check('no console error on the homepage', s.consoleErrors.length === 0, s.consoleErrors.join(' | '));
  s.close();
}

/* ---------- 2. the viewport matrix ---------- */

{
  const s = await session();
  for (const route of ROUTES) {
    for (const [width, height] of VIEWPORTS) {
      await s.resize(width, height);
      await s.goto(route);
      const overflow = await s.evaluate(`(async () => {
        const widths = [];
        for (const y of [0, 1500, 3500, 6000, 9000]) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
          widths.push(document.documentElement.scrollWidth - document.documentElement.clientWidth);
        }
        return Math.max(...widths);
      })()`);
      check(`no sideways scroll at ${width}x${height} on ${route}`, overflow <= 0, `overflow ${overflow}px`);
    }
  }
  s.close();
}

/* ---------- 3. reduced motion arrives finished ---------- */

{
  const s = await session({ reducedMotion: true });
  await s.goto('/?nocover');
  const state = await s.evaluate(`(() => {
    const durations = [...document.querySelectorAll('.tm-crystal__face-shape, .tm-crystal__node, .tm-crystal__fracture, mark.ink, .plate')]
      .map((el) => getComputedStyle(el).transitionDuration)
      .filter((d) => d && d !== '0s');
    return JSON.stringify({
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      moving: durations,
      headline: document.querySelector('h1')?.textContent.trim(),
      cta: Boolean(document.querySelector('.hero .primary-link')),
      crystalFaces: document.querySelectorAll('.hero-crystal [data-face-state]').length,
      printed: [...document.querySelectorAll('.plate')].every((p) => getComputedStyle(p).getPropertyValue('--p').trim() === '1')
    });
  })()`);
  const parsed = JSON.parse(state);
  check('reduced motion is detected', parsed.reduced === true);
  check('no transition runs under reduced motion', parsed.moving.length === 0, parsed.moving.join(', '));
  check('the headline, CTA and crystal are present immediately', Boolean(parsed.headline) && parsed.cta && parsed.crystalFaces === 6);
  check('every plate arrives printed', parsed.printed === true);
  s.close();
}

/* ---------- 4. the keyboard path, end to end ---------- */

{
  const s = await session();
  await s.goto('/?nocover');
  // reach the check, then answer every question with the keyboard alone
  await s.evaluate(`document.querySelector('.hero .primary-link').focus(); "focused"`);
  await s.press('Enter', 'Enter', 13);
  await sleep(400);

  const answered = [];
  for (let step = 0; step < 6; step += 1) {
    const label = await s.evaluate(`(() => {
      const fs = [...document.querySelectorAll('.decision-check fieldset')].find((f) => !f.hidden);
      if (!fs) return null;
      const first = fs.querySelector('input');
      first.focus();
      return fs.querySelector('legend')?.textContent.trim() || '';
    })()`);
    if (label === null) break;
    // Space checks the focused control. An arrow key would move to the next
    // radio first, which on question one answers "No" and takes the early exit.
    await s.press(' ', 'Space', 32);
    const checked = await s.evaluate(`(() => {
      const fs = [...document.querySelectorAll('.decision-check fieldset')].find((f) => !f.hidden);
      if (!fs) return false;
      const input = fs.querySelector('input:checked') || document.activeElement;
      if (input && input.type === 'checkbox' && !input.checked) input.click();
      return Boolean(fs.querySelector('input:checked'));
    })()`);
    answered.push(Boolean(checked));
    const advanced = await s.evaluate(`(() => {
      const next = document.querySelector('[data-step-next]:not([hidden])');
      if (next) { next.focus(); next.click(); return 'next'; }
      const submit = document.querySelector('[data-step-submit]:not([hidden])');
      if (submit) { submit.focus(); submit.click(); return 'submit'; }
      return 'none';
    })()`);
    await sleep(350);
    if (advanced === 'submit') break;
  }
  check('every question can be answered from the keyboard', answered.every(Boolean), `${answered.filter(Boolean).length}/${answered.length}`);

  const result = await s.evaluate(`(() => {
    const r = document.querySelector('[data-decision-result]');
    return JSON.stringify({
      shown: r && !r.hidden,
      faces: r ? r.querySelectorAll('.result-face').length : 0,
      nextTest: r ? (r.querySelector('[data-result-next-test]')?.textContent || '').length : 0,
      cta: Boolean(r && r.querySelector('[data-book-call]'))
    });
  })()`);
  const parsedResult = JSON.parse(result);
  check('the result appears with six faces, a next test and a CTA',
    parsedResult.shown && parsedResult.faces === 6 && parsedResult.nextTest > 0 && parsedResult.cta,
    result);

  const beforeActivation = s.requests.filter((u) => u.includes('calendly')).length;
  check('the scheduler is not contacted before activation', beforeActivation === 0, `${beforeActivation} requests`);

  const focusedCta = await s.evaluate(`(() => {
    const cta = document.querySelector('[data-book-call]');
    cta.focus();
    return document.activeElement === cta;
  })()`);
  check('the booking control can take focus', focusedCta === true);
  await s.press('Enter', 'Enter', 13);
  await sleep(600);
  const transition = await s.evaluate(`document.querySelector('[data-scheduler]')?.dataset.state`);
  const active = await s.evaluate(`document.activeElement.tagName + '.' + document.activeElement.className`);
  check('the branded transition opens on the keyboard', transition === 'transition', `state ${transition}, focus on ${active}`);
  check('still no provider request in the transition',
    s.requests.filter((u) => u.includes('calendly')).length === 0);

  const fallback = await s.evaluate(`(() => {
    const link = document.querySelector('[data-scheduler-fallback]');
    return link ? link.href : '';
  })()`);
  check('a plain external fallback link exists', fallback.includes('calendly.com'), fallback);

  await s.evaluate(`document.querySelector('[data-scheduler-open]').focus(); "focused"`);
  await s.press('Enter', 'Enter', 13);
  await sleep(1200);
  check('the provider loads only after Open scheduling',
    s.requests.filter((u) => u.includes('calendly')).length >= 1);

  await s.evaluate(`document.querySelector('[data-scheduler-close]').focus(); "focused"`);
  await s.press('Enter', 'Enter', 13);
  await sleep(400);
  const focusReturned = await s.evaluate(`document.activeElement?.hasAttribute('data-book-call')`);
  const frameEmpty = await s.evaluate(`document.querySelector('[data-scheduler-frame]').children.length === 0`);
  check('closing returns focus to the booking control', focusReturned === true);
  check('closing removes the provider frame', frameEmpty === true);
  s.close();
}

/* ---------- 5. what the homepage actually loads ---------- */

{
  const s = await session();
  await s.goto('/');
  await sleep(600);
  const thirdParty = s.requests.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:'));
  check('the homepage makes no third-party request', thirdParty.length === 0, thirdParty.join(', '));
  s.close();
}

/* ---------- verdict ---------- */

console.log('');
console.log(`${results.length - failed}/${results.length} checks passed`);
if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log(`QA gate: pass (${root})`);
