"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Wallet,
  Plug,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Desk", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/listings", label: "Listings", icon: Package },
  { href: "/revenue", label: "Revenue", icon: Wallet },
  { href: "/connections", label: "Connections", icon: Plug },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground md:flex">
        <Link href="/" className="mb-8 px-2">
          <p className="font-heading text-2xl leading-none tracking-tight">Pressroom</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/55">
            Etsy × Gelato
          </p>
        </Link>
        <Nav />
        <p className="mt-auto px-2 text-xs leading-5 text-sidebar-foreground/50">
          Paid Etsy orders print through Gelato. Fees, cost, and tracking stay on one desk.
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/" className="font-heading text-xl">
            Pressroom
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
            <SheetHeader>
              <SheetTitle className="text-sidebar-foreground">Pressroom</SheetTitle>
            </SheetHeader>
            <div className="px-2">
              <Nav onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
