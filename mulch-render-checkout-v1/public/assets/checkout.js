(() => {
  'use strict';
  async function start() {
    const core = window.MulchCheckout;
    const form = document.querySelector('[data-subscription-form]');
    if (!core || !form) return;
    const all = selector => Array.from(document.querySelectorAll(selector));
    const status = (text, error = false) => all('[data-whop-status]').forEach(node => { node.textContent = text; node.classList.toggle('is-error', error); });
    let config;
    let selected = '';
    let checkout = null;
    let busy = false;
    let locked = false;
    let sdkPromise = null;
    let generation = 0;
    const storageKey = 'mulch-checkout-reported-result-v1';
    const readSaved = () => { try { return sessionStorage.getItem(storageKey) === 'reported'; } catch { return false; } };
    const save = reported => { try { if (reported) sessionStorage.setItem(storageKey, 'reported'); else sessionStorage.removeItem(storageKey); } catch { /* Provider return still shows its status. */ } };
    function controls() {
      all('[data-plan-select]').forEach(button => { button.disabled = busy || locked; button.setAttribute('aria-pressed', String(button.dataset.planSelect === selected)); });
      all('[data-continue]').forEach(button => { button.disabled = busy || locked || Boolean(checkout) || !config || !selected || !form.elements.acknowledge.checked; button.setAttribute('aria-busy', String(busy)); });
      all('[data-retry-whop]').forEach(button => { button.hidden = !checkout || locked; button.disabled = busy; });
    }
    function destroy() {
      generation++;
      try { checkout?.destroy(); } catch { /* Safe teardown on navigation. */ }
      checkout = null;
      document.querySelector('[data-whop-container]')?.replaceChildren();
      all('[data-whop-panel]').forEach(node => { node.hidden = true; });
    }
    function showNotice(notice) {
      locked = true;
      save(true);
      form.hidden = true;
      all('[data-payment-notice]').forEach(node => { node.hidden = false; });
      all('[data-payment-title]').forEach(node => { node.textContent = notice.title; });
      all('[data-payment-message]').forEach(node => { node.textContent = notice.message; });
      controls();
    }
    function select(code) {
      const plan = core.validatePlan(config, code);
      destroy();
      selected = code;
      form.elements.acknowledge.checked = false;
      all('[data-summary-plan]').forEach(node => { node.textContent = plan.name; });
      all('[data-summary-price]').forEach(node => { node.textContent = `$${(plan.amountMinor / 100).toFixed(2)}`; });
      all('[data-summary-features]').forEach(node => { node.replaceChildren(...plan.features.map(text => { const item = document.createElement('li'); item.textContent = text; return item; })); });
      all('[data-plan-status]').forEach(node => { node.textContent = `${plan.name} selected · $${(plan.amountMinor / 100).toFixed(2)} USD/month per store.`; });
      const url = new URL(core.checkoutUrl(code, window.location.origin));
      if (!new URLSearchParams(window.location.search).has('status')) history.replaceState(null, '', url.pathname + url.search);
      status('Review your plan, then open the secure Whop payment form.');
      controls();
    }
    function loadSdk() {
      if (typeof window.WhopElements === 'function') return Promise.resolve(window.WhopElements);
      if (sdkPromise) return sdkPromise;
      sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = core.SDK_URL;
        script.async = true;
        script.setAttribute('data-whop-elements', '');
        script.setAttribute('data-mulch-whop-sdk', '');
        let settled = false;
        const finish = error => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          script.onload = script.onerror = null;
          if (error) { script.remove(); reject(error); } else resolve(window.WhopElements);
        };
        const timer = setTimeout(() => finish(new Error('Whop took too long to load. Check your connection and try again.')), 20000);
        script.onload = () => finish(typeof window.WhopElements === 'function' ? null : new Error('Whop did not initialize. Please try again.'));
        script.onerror = () => finish(new Error('Whop could not load. Check your connection or content blocker.'));
        document.head.append(script);
      }).catch(error => { sdkPromise = null; throw error; });
      return sdkPromise;
    }
    form.addEventListener('change', controls);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || locked || checkout || !config || !selected || !form.reportValidity() || !form.elements.acknowledge.checked) return;
      busy = true;
      controls();
      const current = ++generation;
      status('Loading secure Whop checkout…');
      try {
        const factory = await loadSdk();
        if (current !== generation) return;
        all('[data-whop-panel]').forEach(node => { node.hidden = false; });
        checkout = core.mountCheckout(factory, config, selected, window.location.origin, completion => {
          if (current !== generation) return;
          showNotice({ title: completion?.result === 'payment' ? 'Whop reports checkout completion' : 'Check your Whop account', message: 'Check your Whop receipt and subscription for confirmation. This page does not verify payment or activate dashboard access; store onboarding is separate. Do not pay again while checking.' });
          status('Payment status and billing records are available in Whop.');
        }, isLoading => { if (current === generation && !locked) status(isLoading ? 'Whop is loading the payment form…' : 'Whop sets the amount due today, taxes and renewal terms. Review them before paying.'); });
        if (!locked) status('Confirm the final amount, renewal schedule and terms in the Whop payment form.');
      } catch (error) { destroy(); status(error.message || 'Whop checkout is unavailable. Please try again.', true); }
      finally { busy = false; controls(); }
    });
    document.addEventListener('click', event => {
      const plan = event.target.closest('[data-plan-select]');
      const close = event.target.closest('[data-retry-whop]');
      const review = event.target.closest('[data-review-again]');
      if (plan && !busy && !locked && config) { try { select(plan.dataset.planSelect); } catch (error) { status(error.message, true); } }
      if (close && !busy && !locked) { destroy(); controls(); status('Form closed. Check Whop for any completed payment before opening it again.'); }
      if (review && !busy) {
        destroy(); locked = false; save(false); form.hidden = false;
        all('[data-payment-notice]').forEach(node => { node.hidden = true; });
        if (selected) { const url = new URL(core.checkoutUrl(selected, window.location.origin)); history.replaceState(null, '', url.pathname + url.search); }
        form.elements.acknowledge.checked = false;
        controls(); status('Only reopen checkout after checking your existing Whop payment and subscription.');
      }
    });
    window.addEventListener('pagehide', () => {
      busy = false;
      form.elements.acknowledge.checked = false;
      destroy();
    });
    window.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      busy = false; destroy();
      if (locked || readSaved()) showNotice({ title: 'Check your previous payment step', message: 'A previous checkout reported an outcome. Check your Whop receipt and subscription before any further payment. This is not verified payment status.' });
      else {
        form.elements.acknowledge.checked = false;
        status('Check your Whop payment and subscription before reopening checkout. Review the plan and acknowledge it again only if another payment is needed.');
      }
      controls();
    });
    try {
      const response = await fetch('/api/public-config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Checkout configuration is unavailable. Reload the page to try again.');
      config = await response.json();
      for (const [selector, value] of [['[data-support-link]', config.supportUrl], ['[data-terms-link]', config.termsUrl], ['[data-privacy-link]', config.privacyUrl]]) {
        if (value) { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password) all(selector).forEach(link => { link.href = url.href; link.hidden = false; }); }
      }
      const params = new URLSearchParams(window.location.search);
      const code = params.has('plan') ? params.get('plan') : 'standard';
      try { select(code); } catch (error) { status(error.message, true); }
      const notice = core.returnNotice(window.location.search);
      if (notice || readSaved()) showNotice(notice || { title: 'Check your previous payment step', message: 'A previous checkout reported an outcome. Check your Whop receipt and subscription before attempting another payment. No service access is activated by this page.' });
    } catch (error) { status(error.message || 'Checkout configuration is unavailable.', true); }
    controls();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
