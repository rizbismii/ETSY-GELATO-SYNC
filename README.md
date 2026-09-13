# Pressroom

Operations desk for **FERNORATRENDS** on Etsy, fulfilled by Gelato. It connects both accounts, publishes the live catalog, maps listings to print products, sends paid receipts to production, pushes tracking back to Etsy, and shows net profit after marketplace fees and print cost.

There is no sample shop. The desk opens on the five live Fernora products in NZD.

## What it does

- **Connect Etsy** with Open API v3 (OAuth 2.0 + PKCE) and **Gelato** with an API key (`X-API-KEY`).
- **Catalog** with AI artwork, Gelato SKUs, destination shipping, and **Save Etsy draft** / **Publish live**.
- **Map listings** to Gelato product UIDs and print files so orders are not blocked.
- **Fulfill** paid Etsy receipts as Gelato v4 orders.
- **Push tracking** from Gelato onto the Etsy receipt (Star Seller / case protection).
- **Price for profit** using Etsy 6.5% transaction + 3% + $0.25 payment fees against Gelato unit cost. Buyer pays Gelato shipping (pass-through).
- **Fix store operations** in one pass: auto-map, reprice thin listings, send ready orders, push missing tracking.

Gelato already offers a native Etsy channel. Pressroom is the control plane around it: catalog publish, blocked orders, margin math, and tracking gaps in one desk.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## Connect your live shops

Etsy’s developer portal **will not accept** `127.0.0.1` or `localhost` as a Callback URL. The field requires an HTTPS public hostname (a `.com` address).

### Local OAuth (HTTPS `.com` tunnel)

1. Keep `npm run dev` running.
2. In a second terminal: `npm run etsy-tunnel`.
3. Copy the printed **Website URL** (`https://….trycloudflare.com`) and **Callback URL** (`https://….trycloudflare.com/api/etsy/callback`).
4. In [Manage your apps](https://www.etsy.com/developers/your-apps) → **fernora-etsgelto-app**, paste those exact values and save.
5. On **Connections**, click **Authorize with Etsy**.

The tunnel hostname changes if Cloudflare recycles it or if you restart `etsy-tunnel`. Update the Etsy app to match the **reachable** Callback URL shown on Connections. A dead trycloudflare hostname will not load.

### Deployed origin

On a public host (for example Vercel), set `ETSY_REDIRECT_URI` to `https://your-domain.com/api/etsy/callback` and use that same value in the Etsy app.

Then:

1. On **Connections**, paste the Etsy keystring and shared secret if they are not already saved.
2. In the [Gelato dashboard](https://dashboard.gelato.com/), create an API key and paste it on the same page.
3. Click **Sync now**, map any unmapped listings, then **Fix store operations**.

Keys can also live in environment variables:

```
ETSY_API_KEY=
ETSY_SHARED_SECRET=
ETSY_REDIRECT_URI=https://your-domain.com/api/etsy/callback
ETSY_PUBLIC_ORIGIN=https://your-domain.com
GELATO_API_KEY=
```

## Live catalog

Five products on **Catalog**, each with an AI print file, a catalog photo, a Gelato SKU, and destination shipping from the shop’s Gelato Etsy profiles (NZ, AU, US, UK, EU). Shop origin on Etsy is Wellington 6012; Gelato still prints in-region. Prices are NZD and target about 42% net after Etsy fees and the highest regional print cost.

| Product | Gelato | Price (NZD) | Shipping profile |
| --- | --- | --- | --- |
| Fern Arc Poster · A3 Semi-Gloss | A3 coated silk | 36.99 | Small Posters |
| Fern Mark Unisex Hoodie · Black · M | Unisex pullover | 84.99 | Hoodies |
| Fern Spray Canvas Tote · Natural | Canvas tote | 47.99 | Tote Bags |
| Fern Band Mug · 11 oz White Ceramic | 11 oz white mug | 28.99 | Mugs 11oz |
| Bush Light Canvas · 16×20 Slim Wrap | Slim wrap canvas | 123.99 | Small Canvas |

Publish options per product: **Save Etsy draft** or **Publish live**. Print files live at `/catalog/*.png` so Gelato can pull artwork from the public hostname.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, and shadcn/ui.
