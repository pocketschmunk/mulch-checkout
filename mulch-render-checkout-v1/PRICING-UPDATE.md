# November 23, 2026 pricing update

Standard is now advertised at **$150 USD/month per store** and Premium at **$250 USD/month per store**. The owner confirmed that prices were already updated in Whop. Existing public plan IDs are retained: Standard `plan_GcWXKubnKvKib`, Premium `plan_HchAp18dt8rm5`. If the owner created new plans instead of editing the existing plans, the new public IDs must be mapped in Render and Shopify. Display copy cannot override Whop billing. Actual first charge, taxes and renewal terms remain provider-controlled; no payment was submitted or existing membership changed in this revision.

The separate **0.5% on every dollar of client-store revenue processed through Mulch, including tax**, remains unchanged. This fixed-price subscription checkout does not collect that revenue fee or process client-store merchandise payments. Fee collection belongs in the future merchant-payment backend.

The version-2 source archive intentionally keeps the folder name `mulch-render-checkout-v1` so the deployed repository and Render paths remain compatible. Do not rename the deployed folder or create a second hosting service. The current Render settings are: Root Directory blank, Dockerfile Path `mulch-render-checkout-v1/Dockerfile`, Docker Build Context Directory `mulch-render-checkout-v1`, Docker Command blank. The original setup guide describes installation into a repository root; retain these deployed subfolder settings for this existing service.

The Apple Pay association file is unchanged: exactly 228 bytes, SHA256 `5d3b5ecee0a3778d40f056bf81bb80dbd36f47e83435a5b41b963f5d414def4c`. No Apple Pay, DNS or Whop domain configuration changes are required for this pricing-only revision.

For the Shopify landing, use the separate `mulch-checkout-shopify-theme-v6.zip`. Upload as an unpublished theme, preserve live customizations and policy/settings values, enable **Theme settings → Whop checkout → Use branded checkout on pay.mulchcheckout.com**, then review and publish the intended theme. Creating this ZIP does not update the live Shopify theme automatically.

Checkout source checks: 16/16 mocked/core/adapter tests pass, including exact updated prices, correct plan selection, consent, safe completion handling and Apple Pay file response. JavaScript/server syntax checks pass. These checks do not prove a completed live payment or dashboard entitlement.
