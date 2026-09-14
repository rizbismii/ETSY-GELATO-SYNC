import { notFound } from "next/navigation";
import { fernoraCatalog, fernoraProduct } from "@/lib/shop";
import { getDeletedListingIds } from "@/lib/tombstones";
import { ProductDetail } from "./ui";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return fernoraCatalog().map((product) => ({ id: product.id }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = fernoraProduct(id);
  if (!product || getDeletedListingIds().includes(id)) notFound();
  return <ProductDetail product={product} />;
}
