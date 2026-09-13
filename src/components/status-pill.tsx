import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  paid: "bg-amber-100 text-amber-900 border-amber-200",
  blocked: "bg-red-100 text-red-800 border-red-200",
  in_production: "bg-sky-100 text-sky-900 border-sky-200",
  shipped: "bg-violet-100 text-violet-900 border-violet-200",
  delivered: "bg-emerald-100 text-emerald-900 border-emerald-200",
  cancelled: "bg-stone-200 text-stone-700 border-stone-300",
  active: "bg-emerald-100 text-emerald-900 border-emerald-200",
  expired: "bg-stone-200 text-stone-700 border-stone-300",
  inactive: "bg-stone-100 text-stone-600 border-stone-200",
  sold_out: "bg-orange-100 text-orange-900 border-orange-200",
  live: "bg-emerald-100 text-emerald-900 border-emerald-200",
  demo: "bg-amber-100 text-amber-900 border-amber-200",
  critical: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-amber-100 text-amber-900 border-amber-200",
  drop: "bg-primary/15 text-primary border-primary/20",
};

const labels: Record<string, string> = {
  paid: "Ready to print",
  blocked: "Blocked",
  in_production: "Printing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  active: "Active",
  expired: "Expired",
  inactive: "Inactive",
  sold_out: "Sold out",
  live: "Live",
  demo: "Sample shop",
  critical: "Down",
  warning: "Waiting",
  drop: "Harvest drop",
};

export function StatusPill({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border capitalize", styles[value] ?? "bg-muted", className)}
    >
      {labels[value] ?? value.replaceAll("_", " ")}
    </Badge>
  );
}
