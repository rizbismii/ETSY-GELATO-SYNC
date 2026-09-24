"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductArt } from "@/components/product-art";
import { api } from "@/lib/api";

type Template = {
  id: string;
  title: string;
  print: string;
  mockup: string;
  fileName: string;
  label: string;
};

type Color = { name: string; uid: string; hex: string; imageUrl: string };

type Payload = {
  templates: Template[];
  colors: { line: string; colors: Color[] };
  openaiKeySet: boolean;
};

export default function PrintsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("live_hoodie_bloom");
  const [prompt, setPrompt] = useState(
    "Rainbow embroidered fern with the line Grow with purpose, Bloom with grace and a small gold heart underneath.",
  );
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0);

  const load = useCallback(async () => {
    try {
      setData(await api<Payload>("/api/prints"));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = useMemo(
    () => data?.templates.find((row) => row.id === selected) || data?.templates[0],
    [data, selected],
  );

  function bust(url?: string) {
    if (!url) return "";
    return `${url}?v=${stamp}`;
  }

  async function sendFile(path: string, extra: Record<string, string>, file?: File) {
    const form = new FormData();
    Object.entries(extra).forEach(([name, value]) => form.append(name, value));
    if (file) form.append("file", file);
    const response = await fetch(path, { method: "POST", body: form });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(json.error || "Request failed");
    return json;
  }

  async function onUpload(file: File, clean: boolean) {
    if (!current) return;
    setBusy("upload");
    try {
      await sendFile("/api/prints/upload", { listingId: current.id, clean: clean ? "1" : "0" }, file);
      setStamp(Date.now());
      toast.success(clean ? "Cleaned and saved as the print template" : "Uploaded print template");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onGenerate(file?: File) {
    if (!current) return;
    setBusy("generate");
    try {
      await sendFile(
        "/api/prints/generate",
        { listingId: current.id, prompt, ...(key.trim() ? { openaiApiKey: key.trim() } : {}) },
        file,
      );
      setStamp(Date.now());
      toast.success("Generated print template");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onSaveKey() {
    setBusy("key");
    try {
      await api("/api/prints/generate", { method: "PUT", body: JSON.stringify({ openaiApiKey: key }) });
      toast.success("Image key saved on this desk");
      setKey("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onPush() {
    if (!current) return;
    setBusy("push");
    try {
      const result = await api<{ notes?: string[] }>("/api/prints/push", {
        method: "POST",
        body: JSON.stringify({ listingId: current.id }),
      });
      toast.success(result.notes?.[0] || "Pushed print and official Printify photos");
      if (result.notes?.slice(1).length) toast.message(result.notes.slice(1, 4).join(" · "));
      setStamp(Date.now());
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!data || !current) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading print templates
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pressroom</p>
        <h1 className="font-heading text-4xl">Print templates</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Generate, edit, or upload the file Printify embroidered or prints. Product photos stay
          official Printify colour mockups — {data.colors.line}. Do not paste homemade black or navy
          composites.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="space-y-2">
          {data.templates.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelected(row.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                row.id === current.id ? "border-foreground bg-card" : "border-border bg-background"
              }`}
            >
              <p className="font-medium">{row.title}</p>
              <p className="text-[11px] text-muted-foreground">{row.fileName}</p>
            </button>
          ))}
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Print file</p>
                <ProductArt
                  id={`${current.id}-print-${stamp}`}
                  title={`${current.title} print file`}
                  imageUrl={bust(current.print)}
                  kind="print"
                  fit="contain"
                  className="aspect-square w-full rounded-lg"
                />
                <p className="mt-2 text-[11px] text-muted-foreground">{current.label}</p>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Official product photo
                </p>
                <ProductArt
                  id={`${current.id}-mockup-${stamp}`}
                  title={current.title}
                  imageUrl={bust(current.mockup)}
                  kind="mockup"
                  fit="contain"
                  className="aspect-square w-full rounded-lg"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="font-medium">AI generate</p>
                <p className="text-xs text-muted-foreground">
                  Creates a clean print file for the selected product. Optional reference image
                  uses edit. Save an OpenAI image key once on this desk.
                </p>
              </div>
              <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} />
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <Label htmlFor="openai-key">Image key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder={data.openaiKeySet ? "Saved on this desk" : "sk-…"}
                  />
                </div>
                <Button variant="outline" className="self-end" onClick={() => void onSaveKey()} disabled={Boolean(busy)}>
                  {busy === "key" ? <Loader2 className="animate-spin" /> : null}
                  Save key
                </Button>
                <Button className="self-end" onClick={() => void onGenerate()} disabled={Boolean(busy)}>
                  {busy === "generate" ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
                  Generate
                </Button>
              </div>
              <Label className="flex cursor-pointer items-center gap-2 text-sm">
                <Upload className="size-4" />
                Generate from a reference image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onGenerate(file);
                    event.target.value = "";
                  }}
                />
              </Label>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="font-medium">Edit or upload</p>
              <p className="text-xs text-muted-foreground">
                Upload a still. For the zip hoodie, cream paper is knocked out to a 1200×1200
                embroidery file automatically.
              </p>
              <div className="flex flex-wrap gap-2">
                <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <Upload className="size-4" />
                  Upload print template
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onUpload(file, false);
                      event.target.value = "";
                    }}
                  />
                </Label>
                <Label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <Wand2 className="size-4" />
                  Upload and clean
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void onUpload(file, true);
                      event.target.value = "";
                    }}
                  />
                </Label>
                <Button onClick={() => void onPush()} disabled={Boolean(busy)}>
                  {busy === "push" ? <Loader2 className="animate-spin" /> : null}
                  Push print + Printify photos
                </Button>
              </div>
            </CardContent>
          </Card>

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Shared colours for this and upcoming products
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.colors.colors.map((color) => (
                <div key={color.uid} className="overflow-hidden rounded-lg border border-border">
                  <ProductArt
                    id={`color-${color.uid}-${stamp}`}
                    title={color.name}
                    imageUrl={bust(color.imageUrl)}
                    kind="mockup"
                    fit="contain"
                    className="aspect-square w-full"
                  />
                  <p className="flex items-center gap-2 px-2 py-1.5 text-xs">
                    <span className="size-3 rounded-full border border-black/10" style={{ background: color.hex }} />
                    {color.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
