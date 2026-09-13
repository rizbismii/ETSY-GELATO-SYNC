import { cn } from "@/lib/utils";

export function ProductArt({
  id,
  title,
  category = "",
  imageUrl,
  className,
}: {
  id: string;
  title: string;
  category?: string;
  imageUrl?: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={title}
        className={cn("object-cover", className)}
      />
    );
  }
  const palettes = [
    ["#3f4a3c", "#c9d4b8", "#8ea37a"],
    ["#2c3a4a", "#d5c4a1", "#7f9bb3"],
    ["#4a2f2c", "#e6d3c5", "#c48b6a"],
    ["#3a332c", "#efe6d6", "#b7a48a"],
    ["#2f3d36", "#dce7dc", "#6f8f7a"],
  ];
  const hash = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = palettes[hash % palettes.length];
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
      <span className="absolute inset-0 flex items-center justify-center font-heading text-2xl text-white/90">
        {title.trim().charAt(0).toUpperCase()}
      </span>
      <span className="sr-only">{category}</span>
    </div>
  );
}
