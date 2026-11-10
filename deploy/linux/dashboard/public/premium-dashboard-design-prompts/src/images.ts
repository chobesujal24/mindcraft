/**
 * Real photography, bundled locally.
 * Every image is graded in CSS — never hotlinked at runtime.
 */
export const photos = {
  heroNight: "/images/hero_fuji_banner.jpg",
  lanternLane: "/images/night-pavilion.jpg",
  pilot: "/images/agent-portrait.jpg",
  pilotAlt: "/images/valkyrie_pilot.jpg",
  blossom: "/images/hero_fuji_banner.jpg",
  fuji: "/images/hero_fuji_banner.jpg",
  castle: "/images/night-pavilion.jpg",
  torii: "/images/agent-portrait.jpg",
  wave: "/images/night-pavilion.jpg",
  lanterns: "/images/night-pavilion.jpg",
  garden: "/images/hero_fuji_banner.jpg",
};

export const photoCredits = [
  { file: "hero-night-blossom", subject: "Illuminated cherry blossoms over water, Japan", by: "Guohua Song", source: "Pexels", id: "36801800" },
  { file: "night-lanterns-lane", subject: "Sakura and lanterns at twilight", by: "Alex Bian", source: "Pexels", id: "37716664" },
  { file: "pilot-lantern", subject: "Portrait with a stone lantern, red kimono", by: "YI REN", source: "Pexels", id: "15155752" },
  { file: "pilot-kimono", subject: "Kimono portrait at a temple lantern", by: "Green odette", source: "Pexels", id: "31169610" },
  { file: "blossom-dark", subject: "Cherry blossoms on a dark backdrop", by: "Ten Ten", source: "Pexels", id: "36797481" },
  { file: "fuji", subject: "Chureito Pagoda, Mount Fuji, spring", by: "Rafael Hideki Tamanaha", source: "Pexels", id: "31418358" },
  { file: "castle", subject: "Osaka Castle at night", by: "Anele Ludaviciute", source: "Pexels", id: "31218434" },
  { file: "torii", subject: "Fushimi Inari torii gate at night", by: "jhon alexis de arco", source: "Pexels", id: "39483795" },
  { file: "wave", subject: "Dark ocean waves in motion", by: "Mathias Reding", source: "Pexels", id: "12777365" },
  { file: "lanterns", subject: "Lanterns at Yasaka Shrine, Kyoto", by: "AXP Photography", source: "Pexels", id: "18848756" },
  { file: "garden", subject: "Stone lantern in a Kyoto garden", by: "Gu Bra", source: "Pexels", id: "7532500" },
];

/** Persona → real landscape photograph. */
export const profilePhoto: Record<string, string> = {
  "mt-fuji": photos.fuji,
  crimson: photos.castle,
  night: photos.lanterns,
  kanagawa: photos.wave,
  ukiyo: photos.torii,
};

/** Bot avatar → real subject crop. */
export const agentPhoto: Record<string, string> = {
  "MC-FOREMAN": photos.fuji,
  "MC-CLUSTER-01": photos.castle,
  "MC-CLUSTER-02": photos.lanterns,
  "MC-CLUSTER-03": photos.wave,
  "MC-CLUSTER-04": photos.torii,
  "MC-CLUSTER-05": photos.blossom,
  "MC-CLUSTER-06": photos.garden,
  "MC-CLUSTER-07": photos.heroNight,
};
