"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductArt } from "@/components/product-art";
import { api } from "@/lib/api";
import {
  DAILY_THEMES,
  DAILY_THEME_META,
  DAILY_WORD_OPTIONS,
  FERNORA_COLLAR_PRINT,
  dailyBatchLabel,
  designsForThemes,
  designsToSave,
  markClean,
  markGlanced,
  prepareDailyBatch,
  type DailyLettering,
  type DailyTheme,
  type ReviewMark,
} from "@/lib/daily-batch";

export function DailyBatch() {
  const [mode, setMode] = useState<DailyLettering["mode"]>("none");
  const [phrases, setPhrases] = useState<Partial<Record<DailyTheme, string>>>({});
  const [themes, setThemes] = useState<DailyTheme[]>([...DAILY_THEMES]);
  const [reviews, setReviews] = useState<Record<string, ReviewMark>>({});
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState<"push" | "clear" | null>(null);
  const label = useMemo(() => dailyBatchLabel(), []);

  const lettering = useMemo<DailyLettering>(
    () => (mode === "none" ? { mode: "none" } : { mode: "words", phrases }),
    [mode, phrases],
  );
  const prepared = useMemo(() => prepareDailyBatch(lettering), [lettering]);
  const visible = useMemo(() => designsForThemes(prepared, themes), [prepared, themes]);
  const clean = useMemo(() => designsToSave(visible, reviews), [visible, reviews]);
  const withWords = visible.filter((row) => row.lettering).length;

  useEffect(() => {
    void api<{ files: string[] }>("/api/prints/daily")
      .then((result) => setSaved(result.files))
      .catch(() => setSaved([]));
  }, []);

  function setLetteringMode(next: DailyLettering["mode"]) {
    setMode(next);
    if (next === "none") setPhrases({});
    setReviews({});
  }

  function pickLine(theme: DailyTheme, line: string) {
    setMode("words");
    setPhrases((current) => {
      const next = { ...current };
      if (next[theme] === line) delete next[theme];
      else next[theme] = line;
      return next;
    });
    setReviews({});
  }

  function toggleTheme(theme: DailyTheme) {
    setThemes((current) =>
      current.includes(theme) ? current.filter((item) => item !== theme) : [...current, theme],
    );
  }

  async function onPush() {
    if (!clean.length) return;
    setBusy("push");
    try {
      const visibleReviews = Object.fromEntries(visible.map((row) => [row.id, reviews[row.id]]));
      const result = await api<{ saved: string[]; files: string[] }>("/api/prints/daily", {
        method: "POST",
        body: JSON.stringify({ action: "push", lettering, reviews: visibleReviews }),
      });
      setSaved(result.files);
      toast.success(`Saved ${result.saved.length} clean design${result.saved.length === 1 ? "" : "s"} on this desk`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onClear() {
    setBusy("clear");
    try {
      const result = await api<{ removed: string[] }>("/api/prints/daily", {
        method: "POST",
        body: JSON.stringify({ action: "clear" }),
      });
      setSaved([]);
      toast.success(
        result.removed.length
          ? `Cleared ${result.removed.length} old desk design${result.removed.length === 1 ? "" : "s"}`
          : "No old desk designs to clear",
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="font-medium">Daily batch · {label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {visible.length} designs on blanks the shop already sells. No words stays off until you
              turn Words on and pick a line. Glance each print, mark the good ones clean, then push
              only those. Push writes files on this desk. Clear removes those desk files. Printify,
              Etsy, and Shopify products stay as they are.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DAILY_THEMES.map((theme) => {
              const on = themes.includes(theme);
              return (
                <Button
                  key={theme}
                  type="button"
                  variant={on ? "default" : "outline"}
                  aria-pressed={on}
                  onClick={() => toggleTheme(theme)}
                >
                  {DAILY_THEME_META[theme].label}
                </Button>
              );
            })}
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
          {mode === "words" ? (
            <div className="space-y-3">
              {DAILY_THEMES.filter((theme) => themes.includes(theme)).map((theme) => (
                <div key={theme}>
                  <p className="text-sm font-medium">{DAILY_THEME_META[theme].label}</p>
                  <p className="text-[11px] text-muted-foreground">{DAILY_THEME_META[theme].note}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DAILY_WORD_OPTIONS[theme].map((option) => {
                      const selected = phrases[theme] === option.line;
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
          ) : (
            <p className="text-xs text-muted-foreground">Seasonal lettering stays off.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void onPush()} disabled={Boolean(busy) || clean.length === 0}>
              Push {clean.length} clean
            </Button>
            <Button type="button" variant="outline" onClick={() => void onClear()} disabled={Boolean(busy)}>
              Clear old desk designs
            </Button>
            <p className="text-xs text-muted-foreground">
              {withWords} with words · {visible.length - withWords} with no words · {saved.length} on this desk
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="font-medium">Collar print · Fernora brand logo</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Every heavy cotton tee in this batch uses this collar print. It is the live neck file,{" "}
              {FERNORA_COLLAR_PRINT.width}×{FERNORA_COLLAR_PRINT.height}, the Fernora wordmark.
            </p>
          </div>
          <a className="text-sm underline" href={FERNORA_COLLAR_PRINT.file} download={FERNORA_COLLAR_PRINT.fileName}>
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

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Turn on Christmas, New Year, summer, or nature.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((design) => {
            const mark = reviews[design.id] || { glanced: false, clean: false };
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
                          () => toast.success("Prompt copied"),
                          () => toast.error("Could not copy the prompt"),
                        );
                      }}
                    >
                      <Copy className="size-4" />
                      Copy prompt
                    </Button>
                    <Button
                      type="button"
                      variant={mark.glanced ? "secondary" : "outline"}
                      aria-pressed={mark.glanced}
                      onClick={() => setReviews((current) => markGlanced(current, design.id, !mark.glanced))}
                    >
                      {mark.glanced ? <Check className="size-4" /> : null}
                      {mark.glanced ? "Glanced" : "Glance"}
                    </Button>
                    <Button
                      type="button"
                      variant={mark.clean ? "default" : "outline"}
                      aria-pressed={mark.clean}
                      disabled={!mark.glanced}
                      onClick={() => setReviews((current) => markClean(current, design.id, !mark.clean))}
                    >
                      {mark.clean ? "Clean" : "Mark clean"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
