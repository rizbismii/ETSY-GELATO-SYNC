"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductArt } from "@/components/product-art";
import {
  DAILY_THEMES,
  DAILY_THEME_META,
  DAILY_WORD_OPTIONS,
  FERNORA_COLLAR_PRINT,
  dailyBatchLabel,
  dailyBatchSummary,
  prepareDailyBatch,
  type DailyLettering,
  type DailyTheme,
} from "@/lib/daily-batch";

type ThemeFilter = "all" | DailyTheme;

export default function DailyBatchPage() {
  const [mode, setMode] = useState<DailyLettering["mode"]>("none");
  const [phrases, setPhrases] = useState<Partial<Record<DailyTheme, string>>>({});
  const [filter, setFilter] = useState<ThemeFilter>("all");
  const [glanced, setGlanced] = useState<string[]>([]);
  const label = useMemo(() => dailyBatchLabel(), []);

  const lettering = useMemo<DailyLettering>(
    () => (mode === "none" ? { mode: "none" } : { mode: "words", phrases }),
    [mode, phrases],
  );
  const prepared = useMemo(() => prepareDailyBatch(lettering), [lettering]);
  const summary = useMemo(() => dailyBatchSummary(prepared), [prepared]);
  const visible = filter === "all" ? prepared : prepared.filter((row) => row.theme === filter);

  function pickLine(theme: DailyTheme, line: string) {
    setMode("words");
    setPhrases((current) => {
      const next = { ...current };
      if (next[theme] === line) delete next[theme];
      else next[theme] = line;
      return next;
    });
    setGlanced([]);
  }

  function setLetteringMode(next: DailyLettering["mode"]) {
    setMode(next);
    if (next === "none") setPhrases({});
    setGlanced([]);
  }

  const letteringLine =
    mode === "none"
      ? "No words is selected, so seasonal lettering stays off."
      : summary.withWords === 0
        ? "Words is open. Pick a line to draw lettering on that theme."
        : `Lines in this batch: ${DAILY_THEMES.flatMap((theme) => {
            const phrase = prepared.find((row) => row.theme === theme)?.phrase;
            return phrase ? [`${DAILY_THEME_META[theme].label} “${phrase}”`] : [];
          }).join(" · ")}.`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pressroom</p>
        <h1 className="font-heading text-4xl">Daily batch</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {label}. {summary.total} designs for Christmas, New Year, summer, and nature, on blanks
          the shop already sells: Gildan 5000 tee, Gildan 18600 zip hoodie, A3 poster, and the
          18×24 botanical print. {letteringLine} Each tee includes the Fernora collar logo. Prepared
          for a glance. A later push stays on{" "}
          <Link href="/prints" className="underline">
            Print templates
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="font-medium">Artwork lettering</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              No words is the path this page opens on. A line is drawn only after you pick it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mode === "none" ? "default" : "outline"}
              aria-pressed={mode === "none"}
              onClick={() => setLetteringMode("none")}
            >
              No words
            </Button>
            <Button
              type="button"
              variant={mode === "words" ? "default" : "outline"}
              aria-pressed={mode === "words"}
              onClick={() => setLetteringMode("words")}
            >
              Words
            </Button>
          </div>
          <div className="space-y-4">
            {DAILY_THEMES.map((theme) => (
              <div key={theme}>
                <p className="text-sm font-medium">{DAILY_THEME_META[theme].label}</p>
                <p className="text-[11px] text-muted-foreground">{DAILY_THEME_META[theme].note}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAILY_WORD_OPTIONS[theme].map((option) => {
                    const selected = mode === "words" && phrases[theme] === option.line;
                    return (
                      <Button
                        key={option.id}
                        type="button"
                        size="sm"
                        variant={selected ? "default" : "outline"}
                        aria-pressed={selected}
                        onClick={() => pickLine(theme, option.line)}
                      >
                        {option.line}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="font-medium">Collar print · Fernora brand logo</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Every heavy cotton tee in this batch uses this collar print. It is the live neck
              file, {FERNORA_COLLAR_PRINT.width}×{FERNORA_COLLAR_PRINT.height}, the Fernora wordmark.
              {summary.collars} tees carry it today.
            </p>
          </div>
          <a
            className="text-sm underline"
            href={FERNORA_COLLAR_PRINT.file}
            download={FERNORA_COLLAR_PRINT.fileName}
          >
            Download collar print
          </a>
          <ProductArt
            id="daily-collar"
            title="Fernora brand logo collar print"
            imageUrl={FERNORA_COLLAR_PRINT.file}
            kind="print"
            fit="contain"
            className="aspect-square max-w-sm rounded-lg bg-white"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All {summary.total}
        </FilterChip>
        {DAILY_THEMES.map((theme) => (
          <FilterChip key={theme} active={filter === theme} onClick={() => setFilter(theme)}>
            {DAILY_THEME_META[theme].label}
          </FilterChip>
        ))}
        <p className="text-xs text-muted-foreground">
          {summary.withWords} with words · {summary.withoutWords} with no words · {glanced.length} glanced
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((design) => {
          const seen = glanced.includes(design.id);
          return (
            <Card key={design.id}>
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Shop blank · {design.product}
                  </p>
                  <ProductArt
                    id={`${design.id}-blank`}
                    title={`${design.blankName} blank`}
                    imageUrl={design.mockup}
                    kind="mockup"
                    fit="contain"
                    className="aspect-[4/3] w-full rounded-lg"
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {design.themeLabel} · {design.blankName}
                  </p>
                  <p className="font-medium">{design.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {design.placement} · {design.size}
                    {design.lettering ? ` · Line: ${design.phrase}` : " · No seasonal lettering"}
                  </p>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{design.prompt}</p>
                {design.collar ? (
                  <div className="flex items-center gap-3">
                    <ProductArt
                      id={`${design.id}-collar`}
                      title="Fernora collar print"
                      imageUrl={design.collar.file}
                      kind="print"
                      fit="contain"
                      className="size-16 rounded-md bg-white"
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      Collar print · {design.collar.label} · {design.collar.width}×{design.collar.height}
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(design.prompt).then(
                        () => toast.success("Prompt copied for review"),
                        () => toast.error("Could not copy the prompt"),
                      );
                    }}
                  >
                    <Copy className="size-4" />
                    Copy prompt
                  </Button>
                  <Button
                    type="button"
                    variant={seen ? "secondary" : "outline"}
                    aria-pressed={seen}
                    onClick={() =>
                      setGlanced((current) =>
                        current.includes(design.id)
                          ? current.filter((id) => id !== design.id)
                          : [...current, design.id],
                      )
                    }
                  >
                    {seen ? <Check className="size-4" /> : null}
                    {seen ? "Glanced" : "Mark glanced"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm ${
        active ? "border-foreground bg-card" : "border-border bg-background"
      }`}
    >
      {children}
    </button>
  );
}
