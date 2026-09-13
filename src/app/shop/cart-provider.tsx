"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine } from "@/lib/shop";

type CartContextValue = {
  lines: CartLine[];
  count: number;
  add: (id: string, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "fernora-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      add: (id, quantity = 1) => {
        setLines((current) => {
          const found = current.find((line) => line.id === id);
          if (found) {
            return current.map((line) =>
              line.id === id ? { ...line, quantity: Math.min(99, line.quantity + quantity) } : line,
            );
          }
          return [...current, { id, quantity }];
        });
      },
      setQuantity: (id, quantity) => {
        setLines((current) =>
          current
            .map((line) => (line.id === id ? { ...line, quantity } : line))
            .filter((line) => line.quantity > 0),
        );
      },
      remove: (id) => setLines((current) => current.filter((line) => line.id !== id)),
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
