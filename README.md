# Pressroom

Operations desk for **FERNORATRENDS** on Etsy and the **Fernora** shop (New Zealand, Australia, the United States, the United Kingdom, the European Union, and selected countries at checkout). **Printify** is the main print supplier except the United Kingdom and the European Union, where **Gelato** stays connected for GPSR. Saved connections stay as they are. The catalog is **one Printify product per item**. Wall art keeps one enabled variant. Mesh sneakers keep every white-sole US size. Etsy, Shopify, and website Catalog dropdowns match: All, Quotes, Botanical, Scenic, Home décor, Original fern.

There is no sample shop. Catalog is five Fernora wall-art mixes plus Southern Cross star mesh sneakers.

## What it does

- **Connect Etsy** with Open API v3 (OAuth 2.0 + PKCE), **Shopify** with a Dev Dashboard app (client ID + secret), and **Gelato** with an API key (`X-API-KEY`).
- **Fernora website** at [fernora.nz](https://fernora.nz) is the **Shopify Online Store** (Horizon theme): native checkout, Shopify Payments, customer accounts, markets, and Gelato destination shipping. Pressroom `/shop` is the operations catalog preview — not the customer storefront.
- **Catalog** with AI artwork, Gelato SKUs, destination shipping, and **Save Etsy draft** / **Publish live**.
- **Map listings** to Gelato product UIDs and print files so orders are not blocked.
- **Fulfill** paid Etsy receipts as Gelato v4 orders.
- **Push tracking** from Gelato onto the Etsy receipt (Star Seller / case protection).
- **Price for profit** using Etsy 6.5% transaction + 3% + $0.25 payment fees against Gelato unit cost. Listings stay priced so a worst-case Etsy Offsite hit still leaves **40%**. Paid traffic to [fernora.nz](https://fernora.nz) is a **Meta campaign from Ads** with a low daily cap (default 5, max 15 in the ad-account currency). Etsy Offsite Ads were opted out on 19 September 2026. Etsy Ads (CPC) are not activated (new-shop 15-day wait).
- **Fix store operations** in one pass: auto-map, reprice thin listings, send ready orders, push missing tracking.

Gelato already offers a native Etsy channel. Pressroom is the control plane around it: catalog publish, blocked orders, margin math, and tracking gaps in one desk.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run desk
```

Open the printed trycloudflare URL for Pressroom, or `/shop` on that host for the Fernora storefront. Locally you can also use [http://127.0.0.1:43127](http://127.0.0.1:43127). `npm run desk` keeps the public tunnel alive and opens a new hostname if Cloudflare drops the old one.

## Fernora shop (Gelato destinations)

The customer website is the **Shopify Online Store** on [fernora.nz](https://fernora.nz) (Horizon theme). The header country control shows **country name · currency code** (for example New Zealand · NZD). Catalog prices convert to that market’s currency (AUD, USD, GBP, EUR). Checkout shipping is the destination rate. Change of mind is not refundable — made-to-order print rules. Customer-facing copy does not name Gelato as the printer. The homepage uses a studio hero, a kōwhai-and-fern palette, and professional collection copy.

Use Shopify’s theme — not a custom Next.js shop — for the public site. Horizon (already live) plus native checkout, Shop Pay, customer accounts, markets, and shipping is what customers need. Pressroom `/shop` stays as a catalog preview for operators.

Paid Fernora orders print through Gelato. Customers pay on Shopify checkout (Shopify Payments: cards, Shop Pay, Apple Pay where available). Pressroom still receives paid-order webhooks so Gelato can print.

Shopify-required pages are the Online Store policies (returns: no change-of-mind returns, 30-day defect reprints). Shopify may auto-manage the privacy policy — turn that off in **Settings → Policies** if you want Fernora’s privacy copy to replace it.

### Shopify (fernora.nz)

The Shopify shop is **gi6ey4-wc.myshopify.com** (storefront [fernora.nz](https://fernora.nz); also **fernora-nzaus.myshopify.com**). Do not use **fernora.myshopify.com** — that is a different, frozen shop. App client ID and secret are stored on Connections.

The admin shop name may still say **My Store 3** — Shopify does not let the API rename it. Change it in **Shopify Admin → Settings → General → Store name** to **Fernora**.

Shopify cannot create a second store with that name from the app keys. To attach the Admin API:

1. Fastest: Dev Dashboard → app → **Home** → **Install app** on this shop. Then on **Connections** click **Get Admin token**. Shopify no longer shows a copyable Admin API token.
2. Or OAuth: click the Active version (**Fernorav1**) → **Create version** → **URLs**. **App URL** must be exactly the live desk origin. **Allowed redirection URL** is `https://your-public-origin/api/shopify/callback`. Release, then **Authorize Shopify**.
3. Click **Publish catalog · Gelato shipping**.

That publishes the five products to the **Online Store** channel (Horizon placeholders disappear once products are on that channel), creates Gelato markets (NZ, AU, US/Americas, UK/Ireland, Europe), writes Shopify legal policies, sets shipping zones and per-product Gelato rate profiles, registers a Gelato carrier callback for mixed-cart destination rates, brands the Horizon homepage, and registers an orders/paid webhook so Gelato can print automatically.

## Connect your live shops

Etsy’s developer portal **will not accept** `127.0.0.1` or `localhost` as a Callback URL. The field requires an HTTPS public hostname (a `.com` address).

### Local OAuth (HTTPS `.com` tunnel)

1. Run `npm run desk` (starts Pressroom and a live trycloudflare hostname). If the desk is already up, `npm run etsy-tunnel` is enough.
2. Copy the printed **Website URL** (`https://….trycloudflare.com`) and **Callback URL** (`https://….trycloudflare.com/api/etsy/callback`).
3. In [Manage your apps](https://www.etsy.com/developers/your-apps) → **fernora-etsgelto-app**, paste those exact values and save.
4. On **Connections**, click **Authorize with Etsy**.

The supervisor replaces a dead tunnel automatically (Cloudflare recycle or failed public health check) and pushes the new hostname to Etsy, Shopify, and Gelato. Old names cannot be reused — copy the live URL from **Connections**. Etsy still needs the Website + Callback URLs pasted into fernora-etsgelto-app if Authorize fails.

### Gelato API key

The key is **not** on the Create store dashboard (`dashboard.gelato.com`). Open the [Gelato API Portal](https://developers.gelato.com), sign in as an admin, then in the left menu: **Developer → API Keys → Add API key**. Name it Pressroom, create it, and copy immediately — Gelato will not show the full secret again. Paste it on **Connections** and click **Save and test Gelato**. Etsy, Shopify, and Gelato app keys stay saved when the Cloudflare hostname changes; only the Website + Callback URLs need pasting into fernora-etsgelto-app. Gelato’s own article: [How do I add an API key?](https://support.gelato.com/en/articles/8996574-how-do-i-add-remove-deactivate-or-replace-an-api-key).

### Deployed origin

On a public host (for example Vercel), set `ETSY_REDIRECT_URI` to `https://your-domain.com/api/etsy/callback` and use that same value in the Etsy app.

Then:

1. On **Connections**, the Etsy keystring, shared secret, Shopify client ID/secret, and Gelato API key are saved on the desk — show or copy them there, or paste replacements.
2. If the tunnel hostname changed, click **Push this tunnel to all three** and confirm each row says **Tunnel updated**.
3. Click **Sync now**, map any unmapped listings, then **Fix store operations**.

Keys can also live in environment variables:

```
ETSY_API_KEY=
ETSY_SHARED_SECRET=
ETSY_REDIRECT_URI=https://your-domain.com/api/etsy/callback
ETSY_PUBLIC_ORIGIN=https://your-domain.com
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_SHOP=gi6ey4-wc.myshopify.com
SHOPIFY_REDIRECT_URI=https://your-domain.com/api/shopify/callback
GELATO_API_KEY=
PRINTIFY_API_TOKEN=
```

## Live catalog

The catalog in this repo is the Fernora mix in NZD: **five wall-art listings**, one per mix, plus **black-camo men’s** and **Southern Cross women’s mesh sneakers**. **One Printify product per item** (wall art: one enabled variant; sneakers: white sole, every US size). Printify is the main printer for non-EU/UK destinations; keep Gelato for UK and EU wall art. Mesh sneakers print on Printify (Smart Printee) — there is no Gelato shoe. Shop origin on Etsy is Wellington 6012. Advertising is a **Meta campaign** from Pressroom **Ads** to fernora.nz (daily cap 5, max 15). Etsy Offsite Ads were opted out on 19 September 2026 — listing prices are **not** padded for a 15% Offsite hit. Etsy Ads (CPC) are not activated (15-day new-shop wait as of 20 September 2026). Catalog dropdowns on Etsy, Shopify, and the website match Printify: All, Quotes, Botanical, Scenic, Home décor, Original fern. Catalog cost tables convert live Printify **USD** print and ship costs to shop NZD (sneakers print US$37.77 = NZ$63.08). Printify listing health always prefixes USD: retail there is the Etsy NZD number, production cost is real USD. Gelato covers UK / EU wall art. Each product stores 13 listing-health tags and extra gallery stills (lifestyle + print + detail).

### Printify

On **Connections**, paste a Printify personal access token from [printify.com/app/account/api](https://printify.com/app/account/api). **Printify is the main supplier except EU/UK.** Keep **Non-EU** — Printify will not save EU without a real EU or Northern Ireland address, and Wellington 6012 is not valid. **Gelato** stays connected for those destinations only. Leave Etsy, Shopify, Printify, and Gelato keys as they are. Do not rebuild Shopify or the website around Gelato yet. External products with Migrate product are leftover listings — do not migrate them. **Create 5-product catalog · publish to shops** removes older products, keeps five Printify products, and publishes them to Etsy, Shopify, and fernora.nz.

### Meta ads

On **Ads**, create a Business app at [developers.facebook.com](https://developers.facebook.com/apps/creation/), add Marketing API, then generate a User token in [Graph API Explorer](https://developers.facebook.com/tools/explorer/) with `ads_management`, `ads_read`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`, and `business_management`. Copy `GET /me/adaccounts`, `GET /me/accounts`, and `GET /act_…/adspixels` IDs into Ads. A Facebook login Meta has disabled cannot issue those calls. Save installs the Pixel on the Horizon theme. **Create paused campaign** builds a traffic campaign to https://fernora.nz for New Zealand and Australia. **Go live** spends only the daily cap. Paid Shopify orders send Purchase events to the Pixel from Pressroom.

| Product | Mix | Price (NZD) |
| --- | --- | --- |
| Fern Arc Poster · A3 | original | 35.99 |
| Breathe. You are here. · A3 | quote | 34.99 |
| Kowhai Bells · 18×24 | botanical | 42.99 |
| Harbour Morning Canvas · 12×12 | scenic | 72.99 |
| Home is a kind light · oak frame | home | 145.99 |
| Black Camo · men’s mesh sneakers | original | 133.99 |
| Southern Cross Star · women’s mesh sneakers | original | 133.99 |

Publish options per product: **Save Etsy draft** or **Publish live**. **Delete** removes the product from Printify, Gelato, inactivates it on Etsy, deletes it from Shopify, and takes it out of Pressroom and `/shop`. Print files live at `/catalog/*.png` and must match the listing photo — never a different fern or quote. Rebuild with `npm run print-files`. **Create 5-product catalog · publish to shops** refreshes Printify print areas so the file customers receive is the design they bought.

### Design options (saved, not built yet)

Do **not** import Printify’s full blueprint catalog into Pressroom. Pressroom only holds Fernora listings: five wall-art mixes plus the Southern Cross star sneakers. A second artwork is a **new listing**, not another variant on Fern Arc.

AI design, when we pick it up: generate **up to five art directions per mix**, publish **one** winner. Generate mockups **from that print file** (hero shelf, flat, detail, room, scale) so the photo and the print stay the same fern or quote. Write title, description, and 13 tags once in Pressroom; publish copies them to Printify, Etsy, Shopify, and fernora.nz. Do not name the printer on customer copy. Extra Printify mockup scenes (toward 20) are still selected in Printify My products.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, and shadcn/ui.
