import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Shopify loads Application URL with ?shop=; send that into the install/OAuth start. */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") return NextResponse.next();
  const shop = request.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.next();
  const next = request.nextUrl.clone();
  next.pathname = "/api/shopify/install";
  return NextResponse.redirect(next);
}
