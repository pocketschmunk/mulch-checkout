import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('./public/', import.meta.url));
export const associationPath = '/.well-known/apple-developer-merchantid-domain-association';
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/brand-mark.svg', ['brand-mark.svg', 'image/svg+xml']],
  ['/assets/checkout.css', ['assets/checkout.css', 'text/css; charset=utf-8']],
  ['/assets/checkout-core.js', ['assets/checkout-core.js', 'application/javascript; charset=utf-8']],
  ['/assets/checkout.js', ['assets/checkout.js', 'application/javascript; charset=utf-8']],
  [associationPath, ['.well-known/apple-developer-merchantid-domain-association', 'application/octet-stream']]
]);
const optionalHttps = value => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
};
export function publicConfig(env = process.env) {
  return {
    plans: {
      standard: { whopPlanId: env.STANDARD_WHOP_PLAN || 'plan_GcWXKubnKvKib' },
      premium: { whopPlanId: env.PREMIUM_WHOP_PLAN || 'plan_HchAp18dt8rm5' }
    },
    landingUrl: 'https://mulchcheckout.com/',
    supportUrl: optionalHttps(env.PUBLIC_SUPPORT_URL),
    termsUrl: optionalHttps(env.PUBLIC_TERMS_URL),
    privacyUrl: optionalHttps(env.PUBLIC_PRIVACY_URL)
  };
}
export function createApp(env = process.env) {
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try { pathname = new URL(req.url, 'http://local.invalid').pathname; }
    catch { res.writeHead(400).end(); return; }
    let content;
    let type;
    if (pathname === '/healthz') {
      content = Buffer.from('{"ok":true}');
      type = 'application/json; charset=utf-8';
    } else if (pathname === '/api/public-config') {
      content = Buffer.from(JSON.stringify(publicConfig(env)));
      type = 'application/json; charset=utf-8';
    } else {
      const file = files.get(pathname);
      if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(req.method === 'HEAD' ? undefined : 'Page not found.');
        return;
      }
      type = file[1];
      try { content = await readFile(resolve(root, file[0])); }
      catch { res.writeHead(503, { 'Content-Type': 'text/plain' }).end('Checkout temporarily unavailable.'); return; }
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': content.length });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '0.0.0.0', () => console.log(`Mulch checkout listening on ${port}`));
}
