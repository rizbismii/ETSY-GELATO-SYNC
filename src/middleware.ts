import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isFernoraStorefrontHost } from "@/lib/shopify-shop";

const STOREFRONT_PREFIXES = [
  "/products",
  "/checkout",
  "/cart",
  "/account",
  "/policies",
  "/contact",
  "/order",
];

/** Shopify loads Application URL with ?shop=; send that into the install/OAuth start.
 *  fernora.nz serves the customer shop at / (and aliases) instead of Pressroom. */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const path = request.nextUrl.pathname;

  if (isFernoraStorefrontHost(host)) {
    if (path === "/") {
      const next = request.nextUrl.clone();
      next.pathname = "/shop";
      return NextResponse.rewrite(next);
    }
    if (STOREFRONT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      const next = request.nextUrl.clone();
      next.pathname = `/shop${path}`;
      return NextResponse.rewrite(next);
    }
    return NextResponse.next();
  }

  if (path !== "/") return NextResponse.next();
  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.next();
  const next = request.nextUrl.clone();
  next.pathname = "/api/shopify/install";
  return NextResponse.redirect(next);
}
