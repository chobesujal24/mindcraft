import { useId } from "react";
import { HERO, blockTexture } from "../assets";
import { AnimatePresence, motion } from "framer-motion";
import { useConsole } from "../state/store";
import { cn } from "../utils/cn";

/* Every piece of art has a drawn fallback, so a missing texture never shows as
   a broken image. */

/* ── Brand crest ───────────────────────────────────────── */

/* The petal points up from the flower's centre at (0, 0). Real sakura petals
   carry a small notch at the tip, which is what separates this from a generic
   five-petal flower. */
const PETAL =
  "M0 -4.6C-5.4 -7.6 -10.6 -14.2 -10.4 -21.4C-10.2 -26.6 -7 -30.2 -3.4 -30.4L0 -26.4L3.4 -30.4C7 -30.2 10.2 -26.6 10.4 -21.4C10.6 -14.2 5.4 -7.6 0 -4.6Z";

/** Brand mark: a notched cherry blossom on a softly lit tile. Theme-aware. */
export function Crest({ size = 34, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Yozakura" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={`crest-lit-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="97" height="97" rx="24" style={{ fill: "var(--panel-2)", stroke: "var(--line-2)" }} strokeWidth="2" />
      <rect x="1.5" y="1.5" width="97" height="97" rx="24" fill={`url(#crest-lit-${id})`} />
      <g transform="translate(50 51) rotate(-18)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <path d={PETAL} style={{ fill: "var(--rose)" }} />
            <path d="M0 -8.5V-21" style={{ stroke: "var(--on-rose)" }} strokeOpacity="0.28" strokeWidth="1.3" strokeLinecap="round" />
          </g>
        ))}
        {[36, 108, 180, 252, 324].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`} style={{ stroke: "var(--gold)", fill: "var(--gold)" }}>
            <path d="M0 -4V-10.5" strokeWidth="1.4" strokeLinecap="round" />
            <circle cy="-11.6" r="1.7" stroke="none" />
          </g>
        ))}
        <circle r="4.6" style={{ fill: "var(--gold)" }} />
      </g>
    </svg>
  );
}

/* ── Minecraft block ───────────────────────────────────── */

/** Base colour and optional ore fleck, used only when a texture is missing. */
const TINT: Record<string, [string, string?]> = {
  ancient_debris: ["#6b4a44", "#a9806f"],
  diamond_ore: ["#7d8087", "#5fd6d0"],
  emerald_ore: ["#7d8087", "#3fc56f"],
  gold_ore: ["#7d8087", "#e7c54a"],
  iron_ore: ["#7d8087", "#d3a98a"],
  copper_ore: ["#7d8087", "#d9824f"],
  coal_ore: ["#7d8087", "#2b2b2e"],
  redstone_ore: ["#7d8087", "#d8362f"],
  lapis_ore: ["#7d8087", "#3760c9"],
  nether_quartz_ore: ["#7a3131", "#e6ddd3"],
  nether_gold_ore: ["#7a3131", "#e7c54a"],
  oak_log: ["#7a5c36"],
  birch_log: ["#d8d2c0"],
  spruce_log: ["#4d3722"],
  jungle_log: ["#6b5a2c"],
  acacia_log: ["#7a5548"],
  dark_oak_log: ["#3b2a18"],
  mangrove_log: ["#6a3b34"],
  cherry_log: ["#4a2a35", "#e7a9bb"],
  stone: ["#7d8087"],
  cobblestone: ["#6f7278"],
  netherrack: ["#7a3131"],
  dirt: ["#7b563a"],
  sand: ["#dccf9f"],
  gravel: ["#85807c"],
  wheat: ["#c9a24a"],
  carrots: ["#e3852b"],
  potatoes: ["#c9a45a"],
  beetroots: ["#9c2f3f"],
  sugar_cane: ["#7fb24c"],
};

const FLECKS: [number, number][] = [[8, 17], [11, 23], [21, 21], [24.5, 15.5], [15, 8], [20, 10.5]];

export function BlockIcon({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const src = blockTexture(name);
  if (src) {
    return <img src={src} alt="" draggable={false} className={cn("shrink-0 select-none", className)} style={{ width: size, height: size }} />;
  }
  const [base, fleck] = TINT[name] ?? ["#7d8087"];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={cn("shrink-0", className)}>
      <polygon points="16,3 29,9.5 16,16 3,9.5" style={{ fill: `color-mix(in oklab, ${base}, white 18%)` }} />
      <polygon points="3,9.5 16,16 16,29.5 3,23" style={{ fill: base }} />
      <polygon points="29,9.5 16,16 16,29.5 29,23" style={{ fill: `color-mix(in oklab, ${base}, black 26%)` }} />
      {fleck && FLECKS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="2.4" height="2.4" fill={fleck} opacity="0.85" />)}
    </svg>
  );
}

/* ── Agent portrait ────────────────────────────────────── */

export function Portrait({ name, src, size = 40, className }: { name: string; src?: string; size?: number; className?: string }) {
  const borderRadius = Math.round(size * 0.26);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn("shrink-0 object-cover ring-1 ring-line-2", className)}
        style={{ width: size, height: size, borderRadius }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center font-display font-semibold ring-1 ring-line-2", className)}
      style={{
        width: size,
        height: size,
        borderRadius,
        fontSize: size * 0.4,
        background: "var(--panel-3)",
        color: "var(--mute)",
      }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/* ── Fleet hero backdrop ───────────────────────────────── */

export function HeroArt() {
  const theme = useConsole((s) => s.theme);
  const src = theme === "hanami" ? HERO.day : HERO.night;
  return (
    <div className="hero-art" aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.div key={theme} className="hero-art-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: "easeOut" }}>
          {src ? <img src={src} alt="" draggable={false} /> : <span />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── Schematic footprint ───────────────────────────────── */

/** Isometric outline of a schematic's bounding box, drawn from its real dimensions. */
export function Blueprint({ dims, size = 40, className }: { dims: [number, number, number]; size?: number; className?: string }) {
  const [w, h, d] = dims;
  const longest = Math.max(w, h, d, 1);
  const sx = w / longest;
  const sy = h / longest;
  const sz = d / longest;
  const project = (x: number, y: number, z: number): [number, number] => [(x * sx - z * sz) * 0.866, (x * sx + z * sz) * 0.5 - y * sy];

  const corner = {
    b: project(1, 0, 0),
    c: project(1, 0, 1),
    d: project(0, 0, 1),
    e: project(0, 1, 0),
    f: project(1, 1, 0),
    g: project(1, 1, 1),
    h: project(0, 1, 1),
  };
  const all = Object.values(corner);
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const pad = 0.12;
  const poly = (...points: [number, number][]) => points.map((p) => p.map((n) => n.toFixed(3)).join(",")).join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      aria-hidden="true"
      className={cn("shrink-0 text-rose", className)}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.035"
      strokeLinejoin="round"
    >
      <polygon points={poly(corner.e, corner.f, corner.g, corner.h)} fillOpacity="0.3" />
      <polygon points={poly(corner.d, corner.c, corner.g, corner.h)} fillOpacity="0.16" />
      <polygon points={poly(corner.b, corner.c, corner.g, corner.f)} fillOpacity="0.07" />
    </svg>
  );
}
