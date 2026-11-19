import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { createApp, associationPath, publicConfig } from '../server.js';

const code = await readFile(new URL('../public/assets/checkout-core.js', import.meta.url), 'utf8');
const context = { URL, URLSearchParams }; vm.createContext(context); vm.runInContext(code, context);
const core = context.MulchCheckout;
const config = publicConfig({});

test('plans retain exact two prices and supplied public identifiers', () => {
  assert.equal(core.validatePlan(config, 'standard').amountMinor, 8999);
  assert.equal(core.validatePlan(config, 'standard').whopPlanId, 'plan_GcWXKubnKvKib');
  assert.equal(core.validatePlan(config, 'premium').amountMinor, 17999);
  assert.equal(core.validatePlan(config, 'premium').whopPlanId, 'plan_HchAp18dt8rm5');
  assert.throws(() => core.planDetails('__proto__'));
  assert.throws(() => core.planDetails('pro'));
});
test('missing, malformed and duplicate plans fail closed', () => {
  assert.throws(() => core.validatePlan({ plans: {} }, 'standard'));
  assert.throws(() => core.validatePlan({ plans: { standard: { whopPlanId: 'javascript:evil' } } }, 'standard'));
  assert.throws(() => core.validatePlan({ plans: { standard: { whopPlanId: 'plan_same' }, premium: { whopPlanId: 'plan_same' } } }, 'standard'));
});
test('return URL preserves only the selected plan on its own secure origin', () => {
  assert.equal(core.checkoutUrl('premium', 'https://pay.mulchcheckout.com'), 'https://pay.mulchcheckout.com/?plan=premium');
  assert.throws(() => core.checkoutUrl('standard', 'http://pay.mulchcheckout.com'));
  assert.equal(core.checkoutUrl('standard', 'http://localhost:3000'), 'http://localhost:3000/?plan=standard');
});
test('provider returns never claim verified access', () => {
  for (const status of ['succeeded', 'failed', 'canceled', 'pending', '<script>']) {
    const notice = core.returnNotice(`?status=${encodeURIComponent(status)}`);
    assert.ok(notice.message.includes('Whop'));
    assert.ok(!notice.message.includes('Your payment is verified'));
  }
  assert.equal(core.returnNotice('?plan=standard'), null);
});
test('SDK adapter creates full official checkout with plan and callback, no fallback', () => {
  let options; let mounted; let destroyed = false;
  const factory = () => ({ checkout: { create: input => { options = input; return { create: type => { assert.equal(type, 'checkout'); return { mount: target => { mounted = target; } }; }, destroy: () => { destroyed = true; } }; } } });
  const complete = () => {};
  core.mountCheckout(factory, config, 'premium', 'https://pay.mulchcheckout.com', complete, () => {});
  assert.equal(options.plan, 'plan_HchAp18dt8rm5');
  assert.equal(options.quantity, 1);
  assert.equal(options.onComplete, complete);
  assert.equal(mounted, '#mc-whop-checkout');
  assert.equal(destroyed, false);
});
test('mount failures destroy provider handles', () => {
  let destroyed = false;
  const factory = () => ({ checkout: { create: () => ({ create: () => ({ mount: () => { throw new Error('failed mount'); } }), destroy: () => { destroyed = true; } }) } });
  assert.throws(() => core.mountCheckout(factory, config, 'standard', 'https://pay.mulchcheckout.com', () => {}, () => {}));
  assert.equal(destroyed, true);
});
test('public config excludes arbitrary private fields and unsafe legal URLs', () => {
  const result = publicConfig({ SECRET: 'never expose', PUBLIC_SUPPORT_URL: 'javascript:evil', PUBLIC_TERMS_URL: 'https://example.com/terms' });
  assert.equal(result.supportUrl, null);
  assert.equal(result.termsUrl, 'https://example.com/terms');
  assert.ok(!JSON.stringify(result).includes('never expose'));
});
test('verification route responds 200 exact 228 bytes without redirects or HTML', async () => {
  const server = createApp({}); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${associationPath}`, { redirect: 'manual' });
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('content-type'), 'application/octet-stream');
    assert.equal(response.headers.get('content-length'), '228');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), '5d3b5ecee0a3778d40f056bf81bb80dbd36f47e83435a5b41b963f5d414def4c');
    const head = await fetch(`http://127.0.0.1:${server.address().port}${associationPath}`, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal((await head.text()).length, 0);
    const missing = await fetch(`http://127.0.0.1:${server.address().port}/.well-known/missing`);
    assert.equal(missing.status, 404); assert.ok(!(await missing.text()).includes('<html'));
    const health = await fetch(`http://127.0.0.1:${server.address().port}/healthz`);
    assert.deepEqual(await health.json(), { ok: true });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
