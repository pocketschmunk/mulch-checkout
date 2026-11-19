import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { publicConfig } from '../server.js';
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const core = await readFile(new URL('../public/assets/checkout-core.js', import.meta.url), 'utf8');
const site = await readFile(new URL('../public/assets/checkout.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function boot(search = '?plan=standard', sdk = true) {
  const dom = new JSDOM(html, { url: `https://pay.mulchcheckout.com/${search}`, runScripts: 'outside-only' });
  const { window } = dom; const captured = [];
  window.fetch = async () => ({ ok: true, json: async () => publicConfig({}) });
  if (sdk) window.WhopElements = () => ({ checkout: { create: options => {
    const entry = { options, destroyed: false }; captured.push(entry);
    return { create: () => ({ mount: target => { window.document.querySelector(target).textContent = 'Mock Whop form'; } }), destroy: () => { entry.destroyed = true; } };
  } } });
  window.eval(core); window.eval(site);
  if (window.document.readyState === 'loading') window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await tick();
  return { dom, window, doc: window.document, captured };
}
function open(state) {
  const checkbox = state.doc.querySelector('[name=acknowledge]'); checkbox.checked = true;
  checkbox.dispatchEvent(new state.window.Event('change', { bubbles: true }));
  state.doc.querySelector('[data-subscription-form]').dispatchEvent(new state.window.Event('submit', { bubbles: true, cancelable: true }));
}
test('headline, exact selected price and disclosure render; no SDK request before consent', async () => {
  const state = await boot();
  try {
    assert.ok(state.doc.body.textContent.includes('Your money, when you need it'));
    assert.equal(state.doc.querySelector('[data-summary-price]').textContent, '$89.99');
    assert.ok(state.doc.body.textContent.includes('0.5%'));
    assert.equal(state.doc.querySelector('[data-continue]').disabled, true);
    assert.equal(state.captured.length, 0);
    assert.equal(state.doc.querySelector('script[data-mulch-whop-sdk]'), null);
  } finally { state.dom.window.close(); }
});
test('consent opens correct plan; repeat submit does not mount another checkout', async () => {
  const state = await boot('?plan=premium');
  try {
    open(state); await tick();
    assert.equal(state.captured.length, 1);
    assert.equal(state.captured[0].options.plan, 'plan_HchAp18dt8rm5');
    assert.equal(state.captured[0].options.returnUrl, 'https://pay.mulchcheckout.com/?plan=premium');
    open(state); await tick(); assert.equal(state.captured.length, 1);
  } finally { state.dom.window.close(); }
});
test('switching plans destroys mount and clears consent', async () => {
  const state = await boot();
  try {
    open(state); await tick();
    state.doc.querySelector('[data-plan-select=premium]').click();
    assert.equal(state.captured[0].destroyed, true);
    assert.equal(state.doc.querySelector('[name=acknowledge]').checked, false);
    assert.equal(state.doc.querySelector('[data-summary-price]').textContent, '$179.99');
  } finally { state.dom.window.close(); }
});
test('forged success return is unverified and cannot automatically open a new checkout', async () => {
  const state = await boot('?plan=standard&status=succeeded&payment=pay_fake');
  try {
    assert.equal(state.doc.querySelector('[data-subscription-form]').hidden, true);
    assert.ok(state.doc.querySelector('[data-payment-message]').textContent.includes('does not verify'));
    assert.equal(state.captured.length, 0);
    state.doc.querySelector('[data-review-again]').click();
    assert.equal(state.doc.querySelector('[data-subscription-form]').hidden, false);
    assert.equal(state.doc.querySelector('[name=acknowledge]').checked, false);
    assert.ok(!state.window.location.search.includes('status'));
  } finally { state.dom.window.close(); }
});
test('completion locks controls and browser restore preserves cautious status', async () => {
  const state = await boot();
  try {
    open(state); await tick(); state.captured[0].options.onComplete({ result: 'payment', paymentId: 'pay_mock' });
    assert.equal(state.doc.querySelector('[data-subscription-form]').hidden, true);
    assert.ok(state.doc.querySelector('[data-payment-message]').textContent.includes('does not verify'));
    state.window.dispatchEvent(new state.window.PageTransitionEvent('pagehide'));
    state.window.dispatchEvent(new state.window.PageTransitionEvent('pageshow', { persisted: true }));
    assert.equal(state.doc.querySelector('[data-subscription-form]').hidden, true);
    assert.equal(state.captured.length, 1);
  } finally { state.dom.window.close(); }
});
test('SDK loading failure offers visible retry and no payment fallback', async () => {
  const state = await boot('?plan=standard', false);
  try {
    open(state); await tick();
    const script = state.doc.querySelector('script[data-mulch-whop-sdk]'); assert.ok(script);
    script.onerror(); await tick();
    assert.ok(state.doc.querySelector('[data-whop-status]').textContent.includes('could not load'));
    assert.equal(state.doc.querySelector('[data-continue]').disabled, false);
    assert.equal(state.captured.length, 0);
  } finally { state.dom.window.close(); }
});
test('invalid plan link never opens payment until a real plan is selected', async () => {
  const state = await boot('?plan=unknown');
  try {
    assert.equal(state.doc.querySelector('[data-continue]').disabled, true);
    assert.equal(state.captured.length, 0);
    state.doc.querySelector('[data-plan-select=standard]').click(); open(state); await tick();
    assert.equal(state.captured[0].options.plan, 'plan_GcWXKubnKvKib');
  } finally { state.dom.window.close(); }
});

test('unfinished checkout browser restore requires fresh consent and payment-status caution', async () => {
  const state = await boot();
  try {
    open(state); await tick();
    state.window.dispatchEvent(new state.window.PageTransitionEvent('pagehide'));
    state.window.dispatchEvent(new state.window.PageTransitionEvent('pageshow', { persisted: true }));
    assert.equal(state.doc.querySelector('[name=acknowledge]').checked, false);
    assert.equal(state.doc.querySelector('[data-continue]').disabled, true);
    assert.ok(state.doc.querySelector('[data-whop-status]').textContent.includes('before reopening'));
    state.doc.querySelector('[data-subscription-form]').dispatchEvent(new state.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick(); assert.equal(state.captured.length, 1);
  } finally { state.dom.window.close(); }
});
