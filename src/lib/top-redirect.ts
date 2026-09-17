/** Shopify admin cannot load in an iframe (“refused to connect”). Bounce to the top window. */
export function topLevelRedirect(url: string) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Opening Shopify</title>
  </head>
  <body style="font-family:system-ui,sans-serif;padding:2rem;line-height:1.5">
    <p>Opening Shopify in this browser tab…</p>
    <p><a href="${url.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}" target="_top" rel="noreferrer">Continue</a></p>
    <script>window.top.location.href = ${JSON.stringify(url)};</script>
  </body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
