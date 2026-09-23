"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ProductArt } from "@/components/product-art";
import { formatMoney } from "@/lib/money";
import { findClothingVariant, defaultClothingVariant } from "@/lib/clothing";
import { shopLane } from "@/lib/shop";
import { gelatoCountryName } from "@/lib/gelato-countries";
import { POLICY_PATHS } from "@/lib/shop-policies";
import { printSurface } from "@/lib/print-file";
import type { LiveProduct } from "@/lib/live-catalog";
import { useCart } from "../../cart-provider";
import { CountrySelect } from "../../country-select";
import { readProfile } from "../../account-store";

const COLOR_SWATCH: Record<string, string> = {
  black: "bg-zinc-900",
  white: "bg-white",
  navy: "bg-[#1d2a4d]",
};

export function ProductDetail({ product }: { product: LiveProduct }) {
  const { add } = useCart();
  const router = useRouter();
  const clothing = Boolean(product.variants?.length);
  const clothingColors = [...new Map((product.variants || []).map((row) => [row.colorUid, row])).values()];
  const clothingSizes = [...new Map((product.variants || []).map((row) => [row.sizeUid, row])).values()];
  const preferred = defaultClothingVariant(product.variants);
  const gallery = [...new Set([product.imageUrl, ...(product.gallery || [])])].filter(
    (file) => file && file !== product.printFileUrl,
  );
  const [country, setCountry] = useState("NZ");
  const [color, setColor] = useState(preferred?.colorUid || clothingColors[0]?.colorUid || "black");
  const [size, setSize] = useState(preferred?.sizeUid || clothingSizes[0]?.sizeUid || "m");
  const [view, setView] = useState<"mockup" | "print">("mockup");
  const [hero, setHero] = useState(product.imageUrl);
  const colorImage = product.variants?.find((row) => row.colorUid === color)?.imageUrl;
  useEffect(() => {
    const saved = readProfile().country;
    if (saved) setCountry(saved);
  }, []);
  useEffect(() => {
    if (colorImage) setHero(colorImage);
  }, [colorImage]);
  const variant = useMemo(
    () =>
      findClothingVariant(
        product.variants,
        product.variants?.find((row) => row.colorUid === color && row.sizeUid === size)?.id,
      ),
    [product.variants, color, size],
  );
  const lane = shopLane(product, country);
  const dtg = printSurface(product.category) === "dtg";

  function addToBag() {
    add(product.id, 1, variant?.id);
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-3">
        <div className="overflow-hidden rounded-[1.6rem] border border-border/70 bg-card">
          <div className="aspect-[4/5]">
            <ProductArt
              id={product.id}
              title={product.title}
              category={product.category}
              imageUrl={view === "print" ? product.printFileUrl || product.imageUrl : hero || product.imageUrl}
              kind={view === "print" ? "print" : "mockup"}
              fit="contain"
              className="size-full"
            />
          </div>
        </div>
        {view === "mockup" && gallery.length > 1 ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {gallery.map((file) => (
              <button
                key={file}
                type="button"
                onClick={() => setHero(file)}
                className={`overflow-hidden rounded-2xl border bg-card ${
                  hero === file ? "border-foreground" : "border-border/70"
                }`}
              >
                <div className="aspect-square">
                  <ProductArt
                    id={`${product.id}-${file}`}
                    title={product.title}
                    category={product.category}
                    imageUrl={file}
                    kind="mockup"
                    fit="contain"
                    className="size-full"
                  />
                </div>
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button size="sm" variant={view === "mockup" ? "default" : "outline"} onClick={() => setView("mockup")}>
            Product
          </Button>
          {product.printFileUrl ? (
            <Button size="sm" variant={view === "print" ? "default" : "outline"} onClick={() => setView("print")}>
              Print file {dtg ? "· ink only" : ""}
            </Button>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          The print file is the same template the printer uses. It is not cropped to the mockup frame, so the
          design on the product matches the artwork.
        </p>
      </div>
      <div className="flex flex-col gap-5">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{product.collection}</p>
        <h1 className="font-heading text-4xl leading-tight md:text-5xl">{product.title}</h1>
        {product.quote ? (
          <p className="font-heading text-2xl text-primary/90">“{product.quote}”</p>
        ) : null}
        <p className="text-sm leading-7 text-muted-foreground">{product.description}</p>
        <p className="text-2xl">{formatMoney(product.price, product.currency)}</p>
        {clothing ? (
          <div className="space-y-4">
            {clothingColors.length > 1 ? (
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Colour</p>
                <div className="flex flex-wrap gap-2">
                  {clothingColors.map((option) => (
                    <Button
                      key={option.colorUid}
                      size="sm"
                      variant={color === option.colorUid ? "default" : "outline"}
                      onClick={() => setColor(option.colorUid)}
                    >
                      <span className={`mr-2 inline-block size-3 rounded-full border border-black/10 ${COLOR_SWATCH[option.colorUid] || "bg-zinc-900"}`} />
                      {option.color}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Size</p>
              <div className="flex flex-wrap gap-2">
                {clothingSizes.map((option) => (
                  <Button
                    key={option.sizeUid}
                    size="sm"
                    variant={size === option.sizeUid ? "default" : "outline"}
                    onClick={() => setSize(option.sizeUid)}
                  >
                    {option.size}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <CountrySelect value={country} onChange={setCountry} label="Ship to" />
        {lane ? (
          <p className="text-sm text-muted-foreground">
            Shipping to {gelatoCountryName(country)} {formatMoney(lane.shipping, product.currency)} · {lane.days}
            {country !== lane.country && lane.region === "EU" ? " · EU print lane" : ""}
          </p>
        ) : (
          <p className="text-sm text-destructive">This piece does not ship to that country.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={addToBag} disabled={!lane}>
            Add to bag
          </Button>
          <Button
            variant="outline"
            disabled={!lane}
            onClick={() => {
              addToBag();
              router.push("/shop/checkout");
            }}
          >
            Buy now
          </Button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border/70">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Ships to</th>
                <th className="px-3 py-2 font-medium">Ship</th>
                <th className="px-3 py-2 font-medium">Landed</th>
                <th className="px-3 py-2 font-medium">Transit</th>
              </tr>
            </thead>
            <tbody>
              {product.lanes.map((row) => (
                <tr
                  key={row.region}
                  className={`border-t border-border/70 ${row.region === lane?.region ? "bg-primary/5" : ""}`}
                >
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2">{formatMoney(row.shipping, product.currency)}</td>
                  <td className="px-3 py-2">{formatMoney(product.price + row.shipping, product.currency)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          Buyer pays destination shipping. Americas and selected Asia / Middle East destinations use
          the US rate, Ireland the UK rate, Switzerland and Norway the EU rate.{" "}
          <Link className="underline" href={POLICY_PATHS.shipping}>
            Shipping policy
          </Link>
          {" · "}
          <Link className="underline" href={POLICY_PATHS.returns}>
            Returns
          </Link>
          {" · "}
          <Link className="underline" href={POLICY_PATHS.payments}>
            Payments
          </Link>
        </p>
        <p className="text-xs leading-6 text-muted-foreground">
          Pay securely on the Shopify invoice after you place the order (cards, Shop Pay, Apple Pay
          where available). Save a customer profile from{" "}
          <Link className="underline" href="/shop/account">
            Account
          </Link>{" "}
          to prefill checkout.
        </p>
      </div>
    </div>
  );
}
