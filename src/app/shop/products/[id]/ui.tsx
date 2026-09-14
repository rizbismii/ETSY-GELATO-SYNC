"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/product-art";
import { formatMoney } from "@/lib/money";
import { CLOTHING_COLORS, CLOTHING_SIZES, findClothingVariant } from "@/lib/clothing";
import { shopLane, type FernoraCountry } from "@/lib/shop";
import type { LiveProduct } from "@/lib/live-catalog";
import { useCart } from "../../cart-provider";

const COLOR_SWATCH: Record<string, string> = {
  black: "bg-zinc-900",
  white: "bg-white",
  navy: "bg-[#1d2a4d]",
};

export function ProductDetail({ product }: { product: LiveProduct }) {
  const { add } = useCart();
  const router = useRouter();
  const clothing = Boolean(product.variants?.length);
  const [country, setCountry] = useState<FernoraCountry>("NZ");
  const [color, setColor] = useState("black");
  const [size, setSize] = useState("m");
  const variant = useMemo(
    () =>
      findClothingVariant(
        product.variants,
        product.variants?.find((row) => row.colorUid === color && row.sizeUid === size)?.id,
      ),
    [product.variants, color, size],
  );
  const lane = shopLane(product, country);

  function addToBag() {
    add(product.id, 1, variant?.id);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="aspect-[4/5]">
          <ProductArt
            id={product.id}
            title={product.title}
            category={product.category}
            imageUrl={product.imageUrl}
            className="size-full"
          />
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{product.collection}</p>
        <h1 className="font-heading text-4xl leading-tight md:text-5xl">{product.title}</h1>
        {product.quote ? (
          <p className="font-heading text-2xl text-primary/90">{product.quote}</p>
        ) : null}
        <p className="text-sm leading-7 text-muted-foreground">{product.description}</p>
        <p className="text-xl">{formatMoney(product.price, product.currency)}</p>
        {clothing ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Colour</p>
              <div className="flex flex-wrap gap-2">
                {CLOTHING_COLORS.map((option) => (
                  <Button
                    key={option.uid}
                    size="sm"
                    variant={color === option.uid ? "default" : "outline"}
                    onClick={() => setColor(option.uid)}
                  >
                    <span className={`mr-2 inline-block size-3 rounded-full border border-black/10 ${COLOR_SWATCH[option.uid]}`} />
                    {option.name}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Size</p>
              <div className="flex flex-wrap gap-2">
                {CLOTHING_SIZES.map((option) => (
                  <Button
                    key={option.uid}
                    size="sm"
                    variant={size === option.uid ? "default" : "outline"}
                    onClick={() => setSize(option.uid)}
                  >
                    {option.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {(["NZ", "AU"] as const).map((code) => (
            <Button
              key={code}
              size="sm"
              variant={country === code ? "default" : "outline"}
              onClick={() => setCountry(code)}
            >
              {code === "NZ" ? "New Zealand" : "Australia"}
            </Button>
          ))}
        </div>
        {lane ? (
          <p className="text-sm text-muted-foreground">
            Gelato shipping {formatMoney(lane.shipping, product.currency)} · {lane.days}
          </p>
        ) : (
          <p className="text-sm text-destructive">This piece does not ship to that country.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={addToBag}>Add to bag</Button>
          <Button
            variant="outline"
            onClick={() => {
              addToBag();
              router.push("/shop/checkout");
            }}
          >
            Buy now
          </Button>
        </div>
      </div>
    </div>
  );
}
