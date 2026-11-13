/**
 * World and schematic photography, resolved from the embedded data-URI module.
 *
 * The console used to point at `/assets/world/*.jpg` and `/src/assets/...`
 * URLs. Neither survives a single-file build, and file imports additionally
 * break any environment that has the source but not the binaries. The rest of
 * this repo already embeds its art as text for that reason, so world imagery
 * now follows the same rule: no image on disk, no broken path, no build that
 * depends on an asset being present.
 */
import { WORLD_ART } from "./embedded/world";

/** Schematic preset id → photograph. `hanami_pavilion` doubles as the default. */
export const WORLD: Record<string, string> = {
  hanami_pavilion: WORLD_ART.hanamiPavilion,
  lantern_pier: WORLD_ART.lanternPier,
  yozakura_bridge: WORLD_ART.moonlitBridge,
  moonlit_bridge: WORLD_ART.moonlitBridge,
  sakura_watchtower: WORLD_ART.cliffsidePagoda,
  cliffside_pagoda: WORLD_ART.cliffsidePagoda,
  cluster_depot: WORLD_ART.clusterDepot,
  perimeter_guard: WORLD_ART.perimeterGuard,
  nether_grind: WORLD_ART.netherGrind,
};

export const heroBanner = WORLD_ART.heroBanner;
export const clusterDepot = WORLD_ART.clusterDepot;
export const perimeterGuard = WORLD_ART.perimeterGuard;
export const netherGrind = WORLD_ART.netherGrind;

/** Never undefined: safe as a last-resort backdrop. */
export const WORLD_DEFAULT = WORLD_ART.hanamiPavilion;

/** Resolve a photograph from a schematic id or file name, with fallback. */
export function worldArt(idOrFileName: string | null | undefined): string {
  if (!idOrFileName) return WORLD_DEFAULT;
  const key = idOrFileName.toLowerCase().replace(/\.schem$/, "");
  if (WORLD[key]) return WORLD[key];
  const hit = Object.keys(WORLD).find((k) => key.includes(k) || k.includes(key));
  return hit ? WORLD[hit] : WORLD_DEFAULT;
}
