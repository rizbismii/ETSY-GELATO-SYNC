"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart-provider";

export function ShopHeader() {
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-[oklch(0.97_0.012_88)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <Link href="/shop" className="leading-none">
          <p className="font-heading text-3xl tracking-tight">Fernora</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            AU & NZ · Gelato print
          </p>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/shop" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            Shop
          </Link>
          <Link href="/shop/checkout" className="relative text-foreground">
            <ShoppingBag className="size-5" />
            {count ? (
              <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {count}
              </span>
            ) : null}
            <span className="sr-only">Cart</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
