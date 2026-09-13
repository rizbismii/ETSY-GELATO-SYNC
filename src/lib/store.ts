import { promises as fs } from "node:fs";
import path from "node:path";
import { seedShop } from "@/lib/demo-data";
import type { ShopState } from "@/lib/types";

const FILE = path.join(process.cwd(), "data", "runtime.json");

let cache: ShopState | null = null;

export async function getShop(): Promise<ShopState> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8")) as ShopState;
    return cache;
  } catch {
    cache = seedShop();
    return cache;
  }
}

export async function saveShop(shop: ShopState) {
  cache = shop;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(shop, null, 2));
  } catch {
    /* keep the in-memory copy if the disk is read-only */
  }
}

export async function resetShop() {
  cache = seedShop();
  await saveShop(cache);
  return cache;
}

export async function updateShop(mutator: (shop: ShopState) => void | Promise<void>) {
  const shop = await getShop();
  await mutator(shop);
  await saveShop(shop);
  return shop;
}
