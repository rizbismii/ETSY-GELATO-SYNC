import { notFound } from "next/navigation";
import { fernoraCatalog, fernoraProduct } from "@/lib/shop";
import { ProductDetail } from "./ui";

export function generateStaticParams() {
  return fernoraCatalog().map((product) => ({ id: product.id }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = fernoraProduct(id);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
