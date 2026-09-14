import Link from "next/link";
import { fernoraCatalog } from "@/lib/shop";
import { getDeletedListingIds } from "@/lib/tombstones";
import { formatMoney } from "@/lib/money";
import { ProductArt } from "@/components/product-art";

export const dynamic = "force-dynamic";

export default function ShopHomePage() {
  const deleted = new Set(getDeletedListingIds());
  const products = fernoraCatalog().filter((product) => !deleted.has(product.id));
  return (
    <div className="flex flex-col gap-10">
      <section className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Print shop · Aotearoa</p>
        <h1 className="mt-3 font-heading text-5xl leading-[0.95] tracking-tight md:text-6xl">
          Quiet work for the house.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
          Fernora sells the live catalog only — quotes, botanicals, scenic prints, and home décor —
          made to order by Gelato. We ship to Australia and New Zealand. Nowhere else.
        </p>
      </section>
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.length === 0 ? (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            Nothing is for sale right now.
          </p>
        ) : (
          products.map((product) => (
          <Link
            key={product.id}
            href={`/shop/products/${product.id}`}
            className="group overflow-hidden rounded-2xl border border-border/70 bg-card"
          >
            <div className="aspect-[4/5] overflow-hidden bg-muted">
              <ProductArt
                id={product.id}
                title={product.title}
                category={product.category}
                imageUrl={product.imageUrl}
                className="size-full transition duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="space-y-1 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {product.collection}
              </p>
              <h2 className="font-heading text-2xl leading-tight">{product.title}</h2>
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
