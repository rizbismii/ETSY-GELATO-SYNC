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

export function ProductArt({
  id,
  title,
  className,
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const palette = palettes[hash(id) % palettes.length];
  const letter = title.trim().charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg",
        className,
      )}
      style={{ background: palette[0] }}
      aria-hidden
    >
      <div
        className="absolute inset-2 rounded-md"
        style={{
          background: `linear-gradient(135deg, ${palette[1]} 0%, ${palette[2]} 100%)`,
        }}
      />
      <div
        className="absolute -right-4 -bottom-6 size-16 rotate-12 rounded-full opacity-40"
        style={{ background: palette[1] }}
      />
      <span className="absolute inset-0 flex items-center justify-center font-heading text-2xl text-white/90">
        {letter}
      </span>
    </div>
  );
}
