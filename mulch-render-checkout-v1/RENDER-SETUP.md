# Host your Mulch checkout on Render

This guide replaces the earlier Manus publishing instructions. Your live checkout will be hosted on **Render**, not Manus. Your main landing website stays on **Shopify**, Namecheap remains your domain/DNS provider, and **Whop** handles subscription payment fields and billing. The future dashboard is not included in this checkout package.

## 1. Put the checkout app in a GitHub repository

Download and extract `mulch-render-checkout-v1.zip`. This is the actual checkout application, **not the Shopify theme ZIP**. Render's repository-based deployment uses source in GitHub, GitLab or Bitbucket; these instructions use GitHub. [1]

Sign in to GitHub, create a repository named `mulch-checkout`, and make it **Private**. If you do not have GitHub yet, create an account first. A private repository can still deploy a publicly accessible checkout on Render. Connect only the required repository when granting Render access.

Upload the extracted files into the repository root, not the ZIP itself and not an extra enclosing directory. In GitHub, use **Add file → Upload files**, upload the extracted root contents, and commit them to `main`. Confirm these paths exist:

```text
Dockerfile
.dockerignore
package.json
server.js
public/index.html
public/assets/checkout.css
public/assets/checkout-core.js
public/assets/checkout.js
public/brand-mark.svg
public/.well-known/apple-developer-merchantid-domain-association
```

The `.well-known` directory begins with a dot and may be hidden on your computer. Make sure its original extensionless file is uploaded with the directory structure intact. Do not rename it, decode its text, paste it into a text editor, or add a newline. It must remain 228 bytes. If you cannot see/upload it, stop and ask for help rather than deploying without it. Git upload preserves dotfiles; drag/drop tools may omit them if you selected only visible files.

There are no private Whop keys in this package. Never add passwords, `.env` files or private API keys to GitHub. Public plan IDs are intentional. The repository includes optional source tests and a pinned test-only dependency; the production Docker image contains no installed dependencies or test tooling.

## 2. Create a Render Web Service

Open `https://dashboard.render.com/`, select **New → Web Service**, connect your GitHub account, and select the `mulch-checkout` repository. **Do not select Static Site, Private Service or a database.** This version uses a small public Node server for its configuration and exact verification route. [1]

Use these settings:

- **Name:** `mulch-checkout` or another available name.
- **Branch:** `main`.
- **Language/Runtime:** **Docker**, even though the app is written in JavaScript.
- **Root Directory:** leave blank if the files are at the repository root.
- **Dockerfile Path:** `Dockerfile` (some screens show `./Dockerfile`).
- **Docker Build Context Directory:** repository root/default `.` if this field is shown.
- **Docker Command:** leave blank; the supplied Dockerfile already starts `node server.js`.
- **Region:** choose one appropriate for your customers. This is a lightweight payment-page wrapper, not the payment processor.
- **Health Check Path:** `/healthz`, under Advanced if available during creation, or in service settings after creation.

Do not add an npm build command or a separate start command to the Docker flow. Render builds the Dockerfile and uses its CMD automatically. The server binds to `0.0.0.0` and honors Render's `PORT`. Leave PORT unset unless Render instructs otherwise. No custom Node-version variable is needed: the Dockerfile uses Node 22. [1] [2]

For customer use, select the paid compute option currently priced **$7/month for 512 MB**. Additional bandwidth/build usage and any paid workspace features can add costs. A paid compute service is distinct from upgrading the workspace plan; do not assume Pro workspace is required for one checkout. Render's Free web-service tier is for testing, sleeps after inactivity and is explicitly not recommended for production. Review the charges before creating the paid service. [3] [4]

No database, Redis, background worker, disk, Shopify Admin token, Phoenix credential or private Whop API key is required for this subscription payment UI.

## 3. Optional environment variables

Both live public plan IDs are already mapped. You can leave them unset, or explicitly add:

```text
STANDARD_WHOP_PLAN=plan_GcWXKubnKvKib
PREMIUM_WHOP_PLAN=plan_HchAp18dt8rm5
```

Use only your verified recurring plan IDs; the two plans must be distinct. Changing the IDs affects the Whop plan purchased, not just display text.

Before accepting customers, configure your real HTTPS support and policy links if you want them displayed:

```text
PUBLIC_SUPPORT_URL
PUBLIC_TERMS_URL
PUBLIC_PRIVACY_URL
```

Set each to a real destination you own or use; do not enter placeholders. Missing links stay hidden. Future private credentials belong in Render's secret/environment controls, never in client JavaScript or the Git repository.

## 4. Deploy and check Render's assigned URL

Click **Deploy/Create Web Service** and wait until Render reports the deployment is live. This starts the hosting service and can incur the selected charges. The package has not already been deployed to your account.

Open the exact `https://...onrender.com` URL shown by Render. Do not assume the hostname based on the display name. Confirm that the branded page loads and these two query selections work on that same assigned URL:

```text
/?plan=standard
/?plan=premium
```

The `/healthz` endpoint should return `{"ok":true}`. The `/api/public-config` endpoint should contain the expected two public IDs. The payment UI loads only after you acknowledge the recurring plan and usage fee; no card form should load before that. Inspecting the page is not a completed payment test. Do not submit a real charge accidentally.

If the deploy fails, send the first meaningful error from Render's deployment logs. If a page/file is missing, check the repository paths before editing payment configuration. No Docker image build on Render or live payment has been verified by this local handoff.

## 5. Add only your checkout custom domain

In Render, open the checkout service → **Settings → Custom Domains → Add Custom Domain**. Enter **`pay.mulchcheckout.com`**, then save. Do **not** add `mulchcheckout.com`, `www.mulchcheckout.com` or a wildcard. Render supports custom subdomains and automatically issues/renews HTTPS certificates after successful verification. [5]

Copy the exact CNAME target shown by Render for this service. It normally corresponds to the service's assigned `...onrender.com` hostname. No service-specific target has been created or verified in this task; do not guess it.

## 6. Add the pay-only record at Namecheap

Open **Domain List → Manage** next to `mulchcheckout.com` → **Advanced DNS → Host Records → Add New Record**:

- **Type:** CNAME Record.
- **Host:** `pay`.
- **Value:** the exact Render CNAME hostname, without `https://`, slashes or query parameters.
- **TTL:** Automatic, or a short value such as 1 minute if offered.

Save the record. Leave Shopify's `@` and `www` records, nameservers, email/MX and other subdomains unchanged. Render's generic Namecheap guide also covers moving an entire root domain; **do not follow its root/@ or www changes for this project**. We are connecting `pay` only. If a conflicting A/AAAA/CNAME/redirect exists for `pay`, inspect its purpose before replacing it. Do not remove records for unrelated hosts. [5] [6]

Return to Render and click **Verify** next to `pay.mulchcheckout.com`. Wait for DNS verification and the HTTPS certificate. Open `https://pay.mulchcheckout.com/` and confirm the checkout appears without certificate errors.

## 7. Verify Apple Pay with Whop on the exact pay host

Open:

```text
https://pay.mulchcheckout.com/.well-known/apple-developer-merchantid-domain-association
```

It must return the original file directly, with no login, HTML page, redirect or error. Expected bytes: **228**. Expected SHA256:

```text
5d3b5ecee0a3778d40f056bf81bb80dbd36f47e83435a5b41b963f5d414def4c
```

The supplied package preserves those bytes. After your deployment, send me the public URL if you want the remote response checked. A local file hash does not prove the final domain serves it correctly.

In Whop, open **Websites**, add/select **`pay.mulchcheckout.com`**, then use **Fix Apple Pay → Check now**. Wait for Apple Pay readiness/`ready` state. Register the pay subdomain, not just the Shopify root domain. Serving the file does not register the domain by itself. Apple Pay availability also depends on the account, browser and eligible wallet; test in Safari on a compatible real Apple device. [7]

## 8. Verify real plan billing and finish Shopify routing

Whop must show Standard **$89.99 USD monthly per store** and Premium **$179.99 USD monthly per store**, with your intended amount due today, taxes, recurring schedule and cancellation terms. Your earlier CSV had a 30-day interval and a $0 initial-price field, so verify the actual provider form before accepting subscriptions. Displayed marketing prices cannot override Whop's billing settings. [8]

The separate **0.5% fee on processed client-store revenue including tax** is not calculated or collected by this fixed subscription checkout. It needs its own future ledger/invoicing. Payment completion does not create dashboard access or connect client stores; verified Whop records and a separate onboarding process are still required.

Only after the Render domain and Whop checkout work, upload/use the separate **v5 Shopify theme ZIP** as an unpublished theme and enable **Theme settings → Whop checkout → Use branded checkout on pay.mulchcheckout.com**. Preserve current live customizations when migrating. Test Standard and Premium buttons in the unpublished theme, then publish the intended theme. They should go to:

```text
https://pay.mulchcheckout.com/?plan=standard
https://pay.mulchcheckout.com/?plan=premium
```

The future dashboard can later be added under your Render account at `app.mulchcheckout.com`; this package is checkout-only. Do not create a database or another service until that app is actually built and its requirements are defined.

## References

[1]: https://render.com/docs/docker "Render Docker deployment settings"
[2]: https://render.com/docs/web-services "Render web services and port binding"
[3]: https://render.com/pricing "Render service and workspace pricing"
[4]: https://render.com/docs/free "Render Free service limitations"
[5]: https://render.com/docs/custom-domains "Render custom domains and automatic HTTPS"
[6]: https://render.com/docs/configure-namecheap-dns "Render Namecheap DNS configuration"
[7]: https://docs.whop.com/payments/apple-pay "Whop Apple Pay file and domain registration"
[8]: https://docs.whop.com/elements/latest/checkout/overview "Whop recurring checkout and browser-status contract"
