import Link from "next/link";
import { POLICY_COPY } from "@/lib/shop-policies";

export function PolicyArticle({
  policy,
}: {
  policy: (typeof POLICY_COPY)[keyof typeof POLICY_COPY];
}) {
  return (
    <article className="mx-auto max-w-2xl space-y-5">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Fernora · fernora.nz</p>
      <h1 className="font-heading text-4xl leading-tight md:text-5xl">{policy.title}</h1>
      <p className="text-sm leading-7 text-muted-foreground">{policy.summary}</p>
      {policy.body.map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="text-sm leading-7 text-foreground/90">
          {paragraph}
        </p>
      ))}
      <p className="text-sm">
        <Link href="/shop" className="underline underline-offset-4">
          Back to the shop
        </Link>
      </p>
    </article>
  );
}
