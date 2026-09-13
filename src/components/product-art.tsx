import { cn } from "@/lib/utils";

const palettes = [
  ["#3f4a3c", "#c9d4b8", "#8ea37a"],
  ["#2c3a4a", "#d5c4a1", "#7f9bb3"],
  ["#4a2f2c", "#e6d3c5", "#c48b6a"],
  ["#3a332c", "#efe6d6", "#b7a48a"],
  ["#2f3d36", "#dce7dc", "#6f8f7a"],
  ["#43364a", "#e5d6e8", "#a889b3"],
];

function hash(value: string) {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function Shape({ category }: { category: string }) {
  if (category === "hoodie") {
    return (
      <div className="absolute inset-x-5 top-3 bottom-2 rounded-t-[22px] rounded-b-md border-2 border-white/55">
        <div className="mx-auto mt-1 h-3 w-8 rounded-full border border-white/50" />
      </div>
    );
  }
  if (category === "tote") {
    return (
      <>
        <div className="absolute top-2 left-1/2 h-5 w-10 -translate-x-1/2 rounded-t-full border-2 border-b-0 border-white/55" />
        <div className="absolute inset-x-5 top-7 bottom-2 rounded-md border-2 border-white/55" />
      </>
    );
  }
  if (category === "framed") {
    return (
      <div className="absolute inset-2 border-[5px] border-white/60">
        <div className="absolute inset-1 border border-white/35" />
      </div>
    );
  }
  if (category === "calendar") {
    return (
      <div className="absolute inset-3 grid grid-cols-3 grid-rows-4 gap-1 rounded-sm border-2 border-white/55 p-1.5">
        {Array.from({ length: 12 }).map((_, index) => (
          <span key={index} className="rounded-[2px] bg-white/35" />
        ))}
      </div>
    );
  }
  if (category === "pillow") {
    return <div className="absolute inset-3 rounded-[28px] border-2 border-white/55" />;
  }
  return (
    <div
      className="absolute -right-4 -bottom-6 size-16 rotate-12 rounded-full opacity-40"
      style={{ background: "white" }}
    />
  );
}

export function ProductArt({
  id,
  title,
  category = "",
  className,
}: {
  id: string;
  title: string;
  category?: string;
  className?: string;
}) {
  const palette = palettes[hash(id) % palettes.length];
  const letter = title.trim().charAt(0).toUpperCase();
  return (
    <div
      className={cn("relative overflow-hidden rounded-lg", className)}
      style={{ background: palette[0] }}
      aria-hidden
    >
      <div
        className="absolute inset-2 rounded-md"
        style={{
          background: `linear-gradient(135deg, ${palette[1]} 0%, ${palette[2]} 100%)`,
        }}
      />
      <Shape category={category} />
      <span className="absolute inset-0 flex items-center justify-center font-heading text-2xl text-white/90">
        {letter}
      </span>
    </div>
  );
}
