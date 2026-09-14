# Pressroom

Operations desk for **FERNORATRENDS** on Etsy and the **Fernora** shop (Australia and New Zealand only), both fulfilled by Gelato. It connects the accounts, publishes the live catalog, maps listings to print products, sends paid receipts to production, and shows net profit after marketplace fees and print cost.

There is no sample shop. The desk opens on the five live Fernora products in NZD.

## What it does

- **Connect Etsy** with Open API v3 (OAuth 2.0 + PKCE), **Shopify** with a Dev Dashboard app (client ID + secret), and **Gelato** with an API key (`X-API-KEY`).
- **Fernora website** at `/shop` — the 20 live products, AU/NZ shipping only, Gelato fulfillment.
- **Catalog** with AI artwork, Gelato SKUs, destination shipping, and **Save Etsy draft** / **Publish live**.
- **Map listings** to Gelato product UIDs and print files so orders are not blocked.
- **Fulfill** paid Etsy receipts as Gelato v4 orders.
- **Push tracking** from Gelato onto the Etsy receipt (Star Seller / case protection).
- **Price for profit** using Etsy 6.5% transaction + 3% + $0.25 payment fees against Gelato unit cost, then **Offsite Ads 15%**. Every current and future listing is priced so **after-ads net is at least 40% of the listing price**. Buyer pays Gelato shipping (pass-through).
- **Fix store operations** in one pass: auto-map, reprice thin listings, send ready orders, push missing tracking.

Gelato already offers a native Etsy channel. Pressroom is the control plane around it: catalog publish, blocked orders, margin math, and tracking gaps in one desk.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127) for Pressroom, or [http://127.0.0.1:43127/shop](http://127.0.0.1:43127/shop) for the Fernora storefront.

## Fernora shop (AU / NZ)

The customer website is `/shop`. It sells the existing 20-piece catalog only, quotes Gelato shipping for New Zealand or Australia, and will not accept any other country.

Paid Fernora orders print through Gelato. Until Shopify checkout is authorized, website checkouts sit as **pending** on the Orders desk. Those rows are unpaid — **Cancel test / unpaid** them. Do not click **Mark paid & print** unless money actually arrived; that submits a real Gelato print.

### Shopify (fernora.myshopify.com)

The Shopify shop name **fernora** already exists. The public myshopify storefront is currently frozen (HTTP 402 — unpaid plan). App client ID and secret are stored on Connections.

Shopify cannot create a second store with that name from the app keys. To attach the Admin API:

1. Unfreeze **fernora** in Shopify admin (pick a plan).
2. In the Dev Dashboard app, add Redirect URL `https://your-public-origin/api/shopify/callback`.
3. On **Connections**, click **Authorize Shopify**, then **Publish catalog · AU/NZ**.

That pushes the 20 products, limits shipping zones to Australia and New Zealand, and registers an orders/paid webhook so Gelato can print automatically.

## Connect your live shops

Etsy’s developer portal **will not accept** `127.0.0.1` or `localhost` as a Callback URL. The field requires an HTTPS public hostname (a `.com` address).

### Local OAuth (HTTPS `.com` tunnel)

1. Keep `npm run dev` running.
2. In a second terminal: `npm run etsy-tunnel`.
3. Copy the printed **Website URL** (`https://….trycloudflare.com`) and **Callback URL** (`https://….trycloudflare.com/api/etsy/callback`).
4. In [Manage your apps](https://www.etsy.com/developers/your-apps) → **fernora-etsgelto-app**, paste those exact values and save.
5. On **Connections**, click **Authorize with Etsy**.

The tunnel hostname changes if Cloudflare recycles it or if you restart `etsy-tunnel`. Quick tunnels cannot reuse a dead name. On **Connections**, saved Etsy / Shopify / Gelato keys stay on the desk (show or copy them there). When the hostname changes, use **Push this tunnel to all three** — each platform shows **Tunnel updated** or **Tunnel not updated**. Etsy still needs the Website + Callback URLs pasted into fernora-etsgelto-app if Authorize fails. Shopify paid-order webhooks and Gelato print-file URLs update from that button.

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
SHOPIFY_SHOP=fernora
SHOPIFY_REDIRECT_URI=https://your-domain.com/api/shopify/callback
GELATO_API_KEY=
```

## Live catalog

The catalog is **20 live listings**: the original fern set plus quotes, botanicals, scenic work, and five home-décor pieces. Shop origin on Etsy is Wellington 6012; Gelato still prints in-region. Advertising is Etsy **Offsite Ads** (15% of an attributed sale only). On-site CPC Etsy Ads stay off. Prices are set so **after-ads profit is at least 40%** in every destination (print + ship + fees + ads). Push those prices to live Etsy listings from Catalog.

| Product | Mix | Price (NZD) |
| --- | --- | --- |
| Fern Arc Poster · A3 | original | 56.99 |
| Fern Mark Hoodie · Black, White, Navy · S–L | original | 125.99 |
| Fern Spray Tote · Natural | original | 71.99 |
| Fern Band Mug · 11 oz | original | 49.99 |
| Bush Light Canvas · 16×20 | original | 176.99 |
| Breathe. You are here. · A3 | quote | 56.99 |
| Light finds a way · A2 | quote | 71.99 |
| Kowhai Bells · 18×24 | botanical | 73.99 |
| Be kind anyway Tee · Black, White, Navy · S–L | quote | 102.99 |
| Grow anyway Tote · Black | quote | 71.99 |
| Good morning, love Mug | quote | 59.99 |
| Soft days ahead Sweatshirt · Black, White, Navy · S–L | quote | 109.99 |
| Harbour Morning Canvas · 12×12 | scenic | 118.99 |
| You belong here · iPhone 15 | quote | 67.99 |
| Pōhutukawa Coast · 12×16 | botanical | 53.99 |
| Home is a kind light · oak frame | home | 184.99 |
| Wild Coast · A3 black frame | home | 197.99 |
| Tui on Kōwhai · wood print | home | 209.99 |
| Be brave in the small hours · acrylic | home | 210.99 |
| Dusk Hills · metallic | home | 153.99 |

Publish options per product: **Save Etsy draft** or **Publish live**. Clothing listings offer Black, White and Navy in S, M and L. **Connect Gelato designs** attaches the print file to each Gelato store variant so the dashboard shows Connected. **Delete** removes the product from Gelato, inactivates it on Etsy, deletes it from Shopify, and takes it out of Pressroom and `/shop`. Print files live at `/catalog/*.png` so Gelato can pull artwork from the public hostname.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, and shadcn/ui.
