import Link from "next/link";
import { CartProvider } from "./cart-provider";
import { ShopHeader } from "./shop-header";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-full flex-col bg-[oklch(0.97_0.012_88)] text-foreground">
        <ShopHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:px-8 md:py-12">
          {children}
        </main>
        <footer className="border-t border-border/70 px-4 py-8 text-center text-xs leading-6 text-muted-foreground">
          <p>Fernora · Made to order in Aotearoa · Ships to Australia and New Zealand</p>
          <p className="mt-1">
            Printed by Gelato near the buyer.{" "}
            <Link className="underline" href="/connections">
              Pressroom
            </Link>
          </p>
        </footer>
      </div>
    </CartProvider>
  );
}
