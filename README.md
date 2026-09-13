# Pressroom

Operations desk for an Etsy shop fulfilled by Gelato. It connects both accounts, maps listings to print products, sends paid receipts to production, pushes tracking back to Etsy, and shows net profit after marketplace fees and print cost.

The app boots with a sample shop (**Hearth & Line**) so fulfillment, mapping, and pricing can be rehearsed before any API keys are added.

## What it does

- **Connect Etsy** with Open API v3 (OAuth 2.0 + PKCE) and **Gelato** with an API key (`X-API-KEY`).
- **Map listings** to Gelato product UIDs and print files so orders are not blocked.
- **Fulfill** paid Etsy receipts as Gelato v4 orders.
- **Push tracking** from Gelato onto the Etsy receipt (Star Seller / case protection).
- **Price for profit** using Etsy 6.5% transaction + 3% + $0.25 payment fees against Gelato unit + ship cost.
- **Harvest drop**: five customized Gelato products (hoodie, tote, framed print, wall calendar, throw pillow) priced for ~42% net, with live order flow.
- **Fix store operations** in one pass: auto-map, reprice thin listings, send ready orders, push missing tracking.

Gelato already offers a native Etsy channel. Pressroom is the control plane around it: blocked orders, margin math, and tracking gaps in one desk.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## Connect your live shops

1. Create an app at [Etsy Developers](https://www.etsy.com/developers/your-apps).
2. Set the redirect URI to `http://127.0.0.1:43127/api/etsy/callback` (or your deployed origin + `/api/etsy/callback`).
3. On **Connections**, paste the keystring and shared secret, then **Authorize with Etsy**.
4. In the [Gelato dashboard](https://dashboard.gelato.com/), create an API key and paste it on the same page.
5. Click **Sync now**, map any unmapped listings, then **Fix store operations**.

Keys can also live in environment variables:

```
ETSY_API_KEY=
ETSY_SHARED_SECRET=
ETSY_REDIRECT_URI=http://127.0.0.1:43127/api/etsy/callback
GELATO_API_KEY=
```

Without keys, every action still runs against the sample shop so you can learn the flow.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, and shadcn/ui.
