import Link from "next/link";
import { fernoraCatalog } from "@/lib/shop";
import { getDeletedListingIds } from "@/lib/tombstones";
import { formatMoney } from "@/lib/money";
import { ProductArt } from "@/components/product-art";
import { FERNORA_SHIP_BLURB } from "@/lib/shop";

export const dynamic = "force-dynamic";

const MIX = [
  { id: "all", label: "All" },
  { id: "quote", label: "Quotes" },
  { id: "botanical", label: "Botanical" },
  { id: "scenic", label: "Scenic" },
  { id: "home", label: "Home décor" },
  { id: "original", label: "Original fern" },
] as const;

export default async function ShopHomePage({
  searchParams,
}: {
  searchParams: Promise<{ mix?: string }>;
}) {
  const { mix = "all" } = await searchParams;
  const deleted = new Set(getDeletedListingIds());
  const products = fernoraCatalog().filter((product) => {
    if (deleted.has(product.id)) return false;
    if (mix === "all") return true;
    return product.collection === mix;
  });
  return (
    <div className="flex flex-col gap-12">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Print shop · fernora.nz · Aotearoa
          </p>
          <h1 className="mt-3 font-heading text-5xl leading-[0.95] tracking-tight md:text-7xl">
            Quiet work for the house.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">
            Botanical studies, kind quotes, scenic canvases and home décor — printed to order by
            Gelato near you. {FERNORA_SHIP_BLURB}
          </p>
        </div>
        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3">Shopify Payments · cards &amp; Shop Pay</li>
          <li className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3">Made to order · 14-day defect returns</li>
          <li className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3">Customer profiles on this device</li>
          <li className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3">NZD prices · destination shipping</li>
        </ul>
      </section>
      <div className="flex flex-wrap gap-2">
        {MIX.map((option) => (
          <Link
            key={option.id}
            href={option.id === "all" ? "/shop" : `/shop?mix=${option.id}`}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              mix === option.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/80 bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <section className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {products.length === 0 ? (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            Nothing is for sale in this mix right now.
          </p>
        ) : (
          products.map((product) => (
            <Link
              key={product.id}
              href={`/shop/products/${product.id}`}
              className="group overflow-hidden rounded-[1.6rem] border border-border/70 bg-card shadow-[0_1px_0_oklch(0.9_0.02_80)] transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="aspect-[4/5] overflow-hidden bg-[oklch(0.94_0.016_86)]">
                <ProductArt
                  id={product.id}
                  title={product.title}
                  category={product.category}
                  imageUrl={product.imageUrl}
                  fit="contain"
                  className="size-full transition duration-500 group-hover:scale-[1.02]"
                />
              </div>
              <div className="space-y-1 p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {product.collection}
                </p>
                <h2 className="font-heading text-2xl leading-tight">{product.title}</h2>
                {product.quote ? (
                  <p className="text-sm italic text-primary/80">“{product.quote}”</p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {formatMoney(product.price, product.currency)}
                </p>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
