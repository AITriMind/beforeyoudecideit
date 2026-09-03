/**
 * TM-05 — the scheduling transition. The rule that matters is negative:
 * nothing of the provider's may be fetched before someone asks for it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SCHEDULER_TIMEOUT_MS,
  bookingUrl,
  providerAllowed,
  schedulerTransition
} from '../assets/domain/scheduler.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CALENDLY = 'https://calendly.com/trmnd-ai/decision-call';

test('the machine walks closed to open only through an explicit activation', () => {
  let state = 'closed';
  state = schedulerTransition(state, 'ACTIVATE');
  assert.equal(state, 'transition');
  state = schedulerTransition(state, 'OPEN');
  assert.equal(state, 'loading');
  state = schedulerTransition(state, 'READY');
  assert.equal(state, 'open');
  state = schedulerTransition(state, 'CLOSE');
  assert.equal(state, 'closed');
});

test('a failed load lands in error and can be retried', () => {
  const failed = schedulerTransition('loading', 'FAIL');
  assert.equal(failed, 'error');
  assert.equal(schedulerTransition(failed, 'RETRY'), 'loading');
  assert.equal(schedulerTransition(failed, 'CLOSE'), 'closed');
});

test('the provider is never reachable before loading', () => {
  assert.equal(providerAllowed('closed'), false);
  assert.equal(providerAllowed('transition'), false);
  assert.equal(providerAllowed('error'), false);
  assert.equal(providerAllowed('loading'), true);
  assert.equal(providerAllowed('open'), true);
});

test('no shortcut skips the branded transition', () => {
  assert.equal(schedulerTransition('closed', 'OPEN'), 'closed');
  assert.equal(schedulerTransition('closed', 'READY'), 'closed');
  assert.equal(schedulerTransition('transition', 'READY'), 'transition');
  assert.equal(schedulerTransition('open', 'OPEN'), 'open');
});

test('the fallback gets eight seconds', () => {
  assert.equal(SCHEDULER_TIMEOUT_MS, 8000);
});

test('answers travel to the booking form and nothing identifying does', () => {
  const url = bookingUrl(CALENDLY, { a1: 'pricing change', a2: 'deadline', a4: '' });
  assert.match(url, /a1=pricing\+change/);
  assert.match(url, /a2=deadline/);
  assert.doesNotMatch(url, /a4=/, 'an empty answer is not sent');
  assert.doesNotMatch(url, /email|name|phone/i);
});

test('an unconfigured booking url yields nothing rather than a broken link', () => {
  assert.equal(bookingUrl('', { a1: 'x' }), '');
  assert.equal(bookingUrl('https://example.com/{{PLACEHOLDER}}', { a1: 'x' }), '');
});

test('the page ships no provider script and no provider iframe', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  // comments are not markup: the page keeps a commented-out video slot
  const live = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(live, /<script[^>]+calendly/i, 'a provider script is in the markup');
  assert.doesNotMatch(live, /<iframe/i, 'an iframe is in the markup');
  // the booking url may appear as an href: a normal link is the no-JS fallback
  assert.ok(live.includes(CALENDLY));
});

test('the iframe is created only inside the loading state, and it is titled', () => {
  const source = readFileSync(join(root, 'assets', 'result.js'), 'utf8');
  const loadingBlock = source.slice(source.indexOf("if (next === 'loading'"), source.indexOf("if (next === 'open')"));
  assert.match(loadingBlock, /createElement\('iframe'\)/);
  assert.match(loadingBlock, /iframe\.title = 'Schedule a 30-minute decision stress test'/);
  const before = source.slice(0, source.indexOf("if (next === 'loading'"));
  assert.doesNotMatch(before, /createElement\('iframe'\)/, 'an iframe is built before loading');
});

test('leaving a provider state tears the frame down', () => {
  const source = readFileSync(join(root, 'assets', 'result.js'), 'utf8');
  assert.match(source, /if \(!providerAllowed\(next\)\) \{[\s\S]*?frame\.textContent = ''/);
});

test('closing returns focus to the booking control', () => {
  const source = readFileSync(join(root, 'assets', 'result.js'), 'utf8');
  assert.match(source, /next === 'closed' && bookCta\) bookCta\.focus/);
});
