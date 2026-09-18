"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";

export type CustomerProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postCode: string;
  country: string;
};

const PROFILE_KEY = "fernora-account-v1";
const ORDERS_KEY = "fernora-orders-v1";

export const EMPTY_PROFILE: CustomerProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postCode: "",
  country: "NZ",
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readProfile(): CustomerProfile {
  return { ...EMPTY_PROFILE, ...readJson<Partial<CustomerProfile>>(PROFILE_KEY, {}) };
}

export function writeProfile(profile: CustomerProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function rememberOrder(order: Order) {
  if (typeof window === "undefined") return;
  const current = readJson<Order[]>(ORDERS_KEY, []);
  const next = [order, ...current.filter((row) => row.id !== order.id)].slice(0, 40);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
}

export function readOrders(): Order[] {
  return readJson<Order[]>(ORDERS_KEY, []);
}

export function useCustomerProfile() {
  const [profile, setProfile] = useState<CustomerProfile>(EMPTY_PROFILE);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(readProfile());
    setOrders(readOrders());
    setReady(true);
  }, []);

  function save(next: CustomerProfile) {
    setProfile(next);
    writeProfile(next);
  }

  return { profile, setProfile: save, orders, ready };
}
