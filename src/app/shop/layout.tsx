import Link from "next/link";
import type { Metadata } from "next";
import { CartProvider } from "./cart-provider";
import { ShopHeader } from "./shop-header";
import { POLICY_PATHS, FERNORA_CONTACT_EMAIL } from "@/lib/shop-policies";

export const metadata: Metadata = {
  title: "Fernora — botanical print shop",
  description:
    "Made-to-order prints, apparel and home décor from Aotearoa. Ships to New Zealand, Australia, and the other countries we deliver to. Pay with Shopify Payments.",
  alternates: { canonical: "https://fernora.nz/shop" },
};

const FOOTER = [
  { href: "/shop", label: "Shop" },
  { href: "/shop/account", label: "Account" },
  { href: POLICY_PATHS.shipping, label: "Shipping" },
  { href: POLICY_PATHS.returns, label: "Returns" },
  { href: POLICY_PATHS.payments, label: "Payments" },
  { href: POLICY_PATHS.privacy, label: "Privacy" },
  { href: POLICY_PATHS.terms, label: "Terms" },
  { href: POLICY_PATHS.contact, label: "Contact" },
];

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-full flex-col bg-[oklch(0.97_0.012_88)] text-foreground">
        <ShopHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:px-8 md:py-12">
          {children}
        </main>
        <footer className="border-t border-border/70 px-4 py-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-heading text-3xl">Fernora</p>
              <p className="mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
                Quiet work for the house. Printed near you after you order. Ships from in-region studios to
                New Zealand, Australia, the United States, the United Kingdom, Europe, and other
                destinations we deliver to. Studio Wellington 6012 is not the parcel origin.
              </p>
            </div>
            <nav className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {FOOTER.map((link) => (
                <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <p className="mx-auto mt-8 max-w-6xl text-center text-[11px] leading-6 text-muted-foreground">
            Pay on Shopify Payments · {FERNORA_CONTACT_EMAIL} · fernora.nz
          </p>
        </footer>
      </div>
    </CartProvider>
  );
}
