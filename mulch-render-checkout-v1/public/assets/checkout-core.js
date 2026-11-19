(() => {
  'use strict';
  const SDK_URL = 'https://cdn.whop.com/elements/amber/elements.js';
  const PLANS = Object.freeze({
    standard: Object.freeze({ code: 'standard', name: 'Standard', amountMinor: 8999,
      features: ['Branded checkout tools', 'Shopify order synchronization', 'Upsells, refunds and conversion reporting'] }),
    premium: Object.freeze({ code: 'premium', name: 'Premium', amountMinor: 17999,
      features: ['Everything in Standard', 'Customer subscriptions and self-service controls', 'Payment recovery and MRR reporting'] })
  });
  function planDetails(code) {
    if (!Object.prototype.hasOwnProperty.call(PLANS, code)) throw new Error('Choose Standard or Premium.');
    return PLANS[code];
  }
  function validatePlan(config, code) {
    const details = planDetails(code);
    const id = String(config.plans?.[code]?.whopPlanId || '').trim();
    if (!/^plan_[A-Za-z0-9]+$/.test(id)) throw new Error(`${details.name} checkout is not configured. No payment has been started.`);
    const other = code === 'standard' ? 'premium' : 'standard';
    if (id === String(config.plans?.[other]?.whopPlanId || '').trim()) throw new Error('The two plans must use distinct Whop plan IDs.');
    return { ...details, whopPlanId: id };
  }
  function checkoutUrl(code, origin) {
    planDetails(code);
    const base = new URL(origin);
    if (base.username || base.password || !(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)))) {
      throw new Error('Use the secure HTTPS checkout page.');
    }
    const url = new URL('/', base.origin);
    url.searchParams.set('plan', code);
    return url.href;
  }
  function returnNotice(search) {
    const params = new URLSearchParams(search);
    if (!params.has('status')) return null;
    const status = params.get('status');
    if (status === 'succeeded') return { title: 'Check your Whop receipt', message: 'The return URL reports completion, but this page does not verify payment. Check your receipt and subscription in Whop before any further payment. Store onboarding is separate.' };
    if (status === 'failed' || status === 'canceled') return { title: 'Check the payment outcome', message: 'The return URL reports a failed or canceled step. Confirm the actual payment status in Whop before reopening checkout.' };
    return { title: 'Check your payment status', message: 'The reported outcome is pending or unrecognized. Check your Whop account before trying again. This page does not verify payment or activate service access.' };
  }
  function mountCheckout(factory, config, code, origin, onComplete, onLoadingChange) {
    if (typeof factory !== 'function') throw new Error('Whop payment form is unavailable.');
    const plan = validatePlan(config, code);
    const options = {
      plan: plan.whopPlanId,
      quantity: 1,
      returnUrl: checkoutUrl(code, origin),
      metadata: { source: 'mulch-branded-checkout', plan_code: code,
        usage_fee_notice: '0.5%_processed_client_store_revenue_including_tax_separate_billing' },
      onComplete, onLoadingChange
    };
    const handle = factory().checkout.create(options);
    try { handle.create('checkout').mount('#mc-whop-checkout'); }
    catch (error) { handle.destroy?.(); throw error; }
    return handle;
  }
  globalThis.MulchCheckout = Object.freeze({ SDK_URL, PLANS, planDetails, validatePlan, checkoutUrl, returnNotice, mountCheckout });
})();
