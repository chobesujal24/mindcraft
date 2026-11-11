/**
 * The console's art lives in ./embedded as text modules (data URIs), so the
 * single-file build never depends on binary files being on disk.
 *
 * Every lookup is optional. If a module is missing the UI falls back to drawn
 * artwork (see ui/art.tsx) instead of rendering a broken image.
 */
type Loose = Record<string, unknown>;

const modules = import.meta.glob("./embedded/*.ts", { eager: true }) as Record<string, Loose>;

const mod = (name: string): Loose => modules[`./embedded/${name}.ts`] ?? {};
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;
const table = (value: unknown): Loose => (value && typeof value === "object" ? (value as Loose) : {});

const blocks = table(mod("blocks").blocks);
const brand = mod("brand");
const avatars = table(brand.avatars);

/** Isometric block render for a Minecraft block id, when one is embedded. */
export const blockTexture = (name: string): string | undefined => text(blocks[name]);

export const CREST = text(brand.crest);

export const AVATARS = {
  eni: text(avatars.eni),
  miner: text(avatars.miner),
  grinder: text(avatars.grinder),
  builder: text(avatars.builder),
};

export const HERO = {
  night: text(mod("hero-night").heroNight),
  day: text(mod("hero-day").heroDay),
};
