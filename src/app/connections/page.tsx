import { Suspense } from "react";
import { ConnectionsClient } from "./ui";

export default function ConnectionsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Checking connections…</p>
      }
    >
      <ConnectionsClient />
    </Suspense>
  );
}
