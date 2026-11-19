# Mulch Checkout — Render source package

This is the separately hosted Mulch-branded Whop subscription checkout for `pay.mulchcheckout.com`. It is **not** the Shopify Liquid theme. The Shopify landing stays at `mulchcheckout.com`; Namecheap stays DNS host. Hosting is Render, not Manus.

See [RENDER-SETUP.md](RENDER-SETUP.md) for GitHub upload, exact Docker service settings, cost, custom-domain/DNS, HTTPS, Whop Apple Pay registration and Shopify handoff instructions.

The application is plain Node 22, HTML, CSS and browser JavaScript. No Manus runtime APIs, database, authentication, secret injection, storage service, badge or hosted asset is required. Original logo and styles are local files. The only payment-library request is Whop's official browser SDK; Whop controls payment fields and actual billing. Any documentation mentioning Manus describes the explicit no-hosting restriction, not a runtime dependency.

`server.js` serves the page, public plan mapping, health and the exact raw Apple Pay file. Docker needs no dependency install or framework build. It copies `server.js`, `package.json` and `public/`, runs as a non-root user, and starts `node server.js`. Render's `PORT` is honored. Tests/dev dependencies are excluded from the image.

Plan defaults: Standard `plan_GcWXKubnKvKib`, advertised $89.99 USD monthly/store; Premium `plan_HchAp18dt8rm5`, advertised $179.99. Confirm actual first charge, taxes, recurrence and cancellation inside Whop before launch. Separate0.5% client-store revenue usage billing is not collected by this page. No Phoenix dependency, Shop Pay/native fallback, dashboard entitlement, client-store order routing or API-key collection is included.

The user's Apple Pay file remains exactly228bytes, SHA256 `5d3b5ecee0a3778d40f056bf81bb80dbd36f47e83435a5b41b963f5d414def4c`, with no trailing newline. Do not modify or decode it. The raw route must be publicly verified after deployment, then the domain registered in Whop; a source package alone cannot activate wallets.

Local source checks on the original checkout passed16mocked tests; the portable server's own adapter/file-response suite is rerun during packaging. No live Render deployment or charge is claimed. To run optional complete tests, install pinned dev dependencies with pnpm then use `pnpm test`; production itself uses no installed packages.
