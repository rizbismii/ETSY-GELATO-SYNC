# Agent notes

## Cursor Cloud specific instructions

Fernora Pressroom is cost-sensitive. Keep cloud spend low.

- Do not record the screen. Do not save walkthrough videos, demo clips, or shorts.
- Do not start extra cloud agents, environment builds, snapshots, or computer-use browser sessions.
- Do not call paid image, video, or ad APIs (OpenAI image generation, Gemini, Meta campaign create or go-live, or live Etsy, Shopify, Printify, and Gelato writes) unless the user asks for that live action in the same message.
- Verify with `npm test`. Run `npm run lint` when you change TypeScript or UI. Use a local `npm run dev` and `curl` only when a route has to be checked. Skip the public Cloudflare tunnel (`npm run desk`) unless the user asks for OAuth or a live hostname.
- One focused change, local checks, then stop.
