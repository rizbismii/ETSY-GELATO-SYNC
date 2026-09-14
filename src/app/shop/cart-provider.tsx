"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { cartLineKey, type CartLine } from "@/lib/shop";

type CartContextValue = {
  lines: CartLine[];
  count: number;
  add: (id: string, quantity?: number, variantId?: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "fernora-cart-v2";

function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem("fernora-cart");
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(lines));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeCart(lines);
  }, [lines, ready]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      add: (id, quantity = 1, variantId) => {
        setLines((current) => {
          const found = current.find(
            (line) => line.id === id && (line.variantId || "") === (variantId || ""),
          );
          const next = found
            ? current.map((line) =>
                line.id === id && (line.variantId || "") === (variantId || "")
                  ? { ...line, quantity: Math.min(99, line.quantity + quantity) }
                  : line,
              )
            : [...current, { id, quantity, variantId }];
          writeCart(next);
          return next;
        });
      },
      setQuantity: (key, quantity) => {
        setLines((current) =>
          current
            .map((line) => (cartLineKey(line) === key ? { ...line, quantity } : line))
            .filter((line) => line.quantity > 0),
        );
      },
      remove: (key) => setLines((current) => current.filter((line) => cartLineKey(line) !== key)),
      clear: () => setLines([]),
    }),
    [lines],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used in the Fernora shop");
  return value;
}
