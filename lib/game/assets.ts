/** The single contract between the game and an artist's asset pack. */
export type ModelClip = "idle" | "swat" | "celebrate" | "upgrade";
export type AssetManifest = {
  version: 1;
  cat: {
    model: string | null;
    height: number;
    clips: Record<ModelClip, string>;
  };
  planet: { texture: string };
  asteroids: Record<
    "rock" | "iron" | "splitter" | "comet" | "boss",
    string | null
  >;
  audio: Record<"levelComplete" | "upgrade", { url: string; volume: number }>;
  upgradeIcons: Record<"power" | "chain" | "charge" | "heal", string | null>;
};
export const DEFAULT_ASSETS: AssetManifest = {
  version: 1,
  cat: {
    model: null,
    height: 1.8,
    clips: {
      idle: "Idle",
      swat: "Swat",
      celebrate: "Celebrate",
      upgrade: "Mrow",
    },
  },
  planet: { texture: "/assets/textures/earth.jpg" },
  asteroids: {
    rock: null,
    iron: null,
    splitter: null,
    comet: null,
    boss: null,
  },
  audio: {
    levelComplete: { url: "/assets/audio/level-complete.wav", volume: 0.65 },
    upgrade: { url: "/assets/audio/upgrade-mrow.wav", volume: 0.6 },
  },
  upgradeIcons: { power: null, chain: null, charge: null, heal: null },
};
const path = (x: unknown): x is string =>
  typeof x === "string" &&
  /^\/(?!\/)[^\s?#]+(?:\?[^\s#]*)?$/.test(x) &&
  !x.includes("..");
/** Reject invalid packs as a whole, so a bad edit cannot half-configure the game. */
export function parseManifest(value: unknown): AssetManifest {
  const v = value as AssetManifest;
  if (
    !v ||
    v.version !== 1 ||
    !v.cat ||
    !v.planet ||
    !v.asteroids ||
    !v.audio ||
    !v.upgradeIcons
  )
    throw new Error("Expected an asset manifest with version 1");
  if (v.cat.model !== null && !path(v.cat.model))
    throw new Error("cat.model must be null or a same-origin /path");
  if (!Number.isFinite(v.cat.height) || v.cat.height < 0.5 || v.cat.height > 3)
    throw new Error("cat.height must be between 0.5 and 3");
  for (const key of ["idle", "swat", "celebrate", "upgrade"] as const)
    if (typeof v.cat.clips?.[key] !== "string")
      throw new Error(`Missing cat clip: ${key}`);
  if (!path(v.planet.texture)) throw new Error("Missing planet texture path");
  for (const key of Object.keys(
    DEFAULT_ASSETS.asteroids,
  ) as (keyof AssetManifest["asteroids"])[])
    if (v.asteroids[key] !== null && !path(v.asteroids[key]))
      throw new Error(`Invalid asteroid model: ${key}`);
  for (const key of ["levelComplete", "upgrade"] as const) {
    const a = v.audio[key];
    if (
      !a ||
      !path(a.url) ||
      !Number.isFinite(a.volume) ||
      a.volume < 0 ||
      a.volume > 1
    )
      throw new Error(`Invalid audio entry: ${key}`);
  }
  for (const key of Object.keys(
    DEFAULT_ASSETS.upgradeIcons,
  ) as (keyof AssetManifest["upgradeIcons"])[])
    if (v.upgradeIcons[key] !== null && !path(v.upgradeIcons[key]))
      throw new Error(`Invalid upgrade icon: ${key}`);
  return v;
}
export async function loadManifest(): Promise<AssetManifest> {
  try {
    const r = await fetch("/assets/manifest.json", {
      cache: "no-cache",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return parseManifest(await r.json());
  } catch (e) {
    console.warn("Asset pack unavailable; using built-in assets.", e);
    return DEFAULT_ASSETS;
  }
}
