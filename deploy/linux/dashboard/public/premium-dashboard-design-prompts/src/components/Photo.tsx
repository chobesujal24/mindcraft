import { cn } from "../utils/cn";

/**
 * A graded photograph. All images are real, locally hosted, and treated with
 * the same editorial grade so they sit inside the interface rather than on top.
 */
export function Photo({
  src,
  alt,
  className,
  position = "center",
  grade = "editorial",
  overlay,
}: {
  src: string;
  alt: string;
  className?: string;
  position?: string;
  grade?: "editorial" | "night" | "plain";
  overlay?: "bottom" | "left" | "full" | "none";
}) {
  return (
    <div className={cn("relative overflow-hidden bg-raise", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(
          "h-full w-full object-cover transition-transform duration-[1400ms] ease-out",
          grade === "editorial" && "saturate-[0.82] contrast-[1.04] brightness-[0.86]",
          grade === "night" && "saturate-[0.6] contrast-[1.06] brightness-[0.62]",
          "group-hover:scale-[1.03]",
        )}
        style={{ objectPosition: position }}
      />
      <span className="pointer-events-none absolute inset-0 bg-[#1A1014] mix-blend-soft-light opacity-45" aria-hidden="true" />
      {overlay === "bottom" && <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D0A10] via-[#0D0A10]/30 to-transparent" aria-hidden="true" />}
      {overlay === "left" && <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0D0B0F] via-[#0D0B0F]/55 to-transparent" aria-hidden="true" />}
      {overlay === "full" && <span className="pointer-events-none absolute inset-0 bg-[#0B090C]/55" aria-hidden="true" />}
      <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.08]" aria-hidden="true" />
    </div>
  );
}

export function AvatarPhoto({
  src,
  alt,
  size = 36,
  className,
  ring,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 overflow-hidden rounded-[9px] bg-raise", ring && "ring-1 ring-blush/30 ring-offset-2 ring-offset-void", className)}
      style={{ width: size, height: size }}
    >
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover saturate-[0.85] brightness-[0.92]" />
      <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.12]" />
    </span>
  );
}

export function Credit({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[7.5px] uppercase tracking-[0.1em] text-ink-mute/60", className)}>{children}</span>;
}
