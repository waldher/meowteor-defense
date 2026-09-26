# Meowteor Defense — artist handoff

Pawlenet Earth has a giant orange bodyguard. The current art is a replaceable placeholder; collision shapes, scoring, progression, and difficulty live separately in `lib/game/simulation.ts`.

## Where to start

All production art lives under `public/assets/`. Select files in **`public/assets/manifest.json`**. A path beginning `/assets/` maps to this directory. No gameplay edits are needed. Existing names can be overwritten, or you can choose new filenames in the manifest. Refresh the game after changing the pack. Publish the changed files to update the live site.

The manifest is fetched at startup. `null` means use the built-in model/icon. An invalid manifest falls back to the complete default pack. Missing or invalid GLBs keep the built-in model; missing vocals use a synthesized fallback. Browser console warnings identify missing files. Keep files on the same origin; remote asset URLs are intentionally not accepted.

| Asset            | Manifest entry                                     | Format                                            | Contract / suggested budget                                                                 |
| ---------------- | -------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Cat              | `cat.model`                                        | glTF 2.0 binary `.glb`                            | Self-contained with embedded textures; ideally under 2 MB, 15,000 triangles and 4 materials |
| Cat animations   | `cat.clips`                                        | Animation clips inside the cat GLB                | `Idle`, `Swat`, `Celebrate`, `Mrow`; names are configurable                                 |
| Planet           | `planet.texture`                                   | JPG, PNG, or WebP                                 | 2:1 equirectangular, 2048 × 1024 recommended; under 1 MB                                    |
| Regular asteroid | `asteroids.rock`                                   | `.glb`                                            | Gray/brown, irregular rock; ideally under 1,500 triangles                                   |
| Armored asteroid | `asteroids.iron`                                   | `.glb`                                            | Distinct metallic blue; same size convention                                                |
| Splitting meteor | `asteroids.splitter`                               | `.glb`                                            | Distinct pink; recognize at a glance                                                        |
| Fast comet       | `asteroids.comet`                                  | `.glb`                                            | Distinct cyan; same size convention                                                         |
| Boss             | `asteroids.boss`                                   | `.glb`                                            | Large purple threat; ideally under 5,000 triangles                                          |
| Completion purr  | `audio.levelComplete`                              | PCM WAV, MP3, or Ogg supported by target browsers | About 2 seconds; no leading silence; volume 0–1                                             |
| Upgrade Mrow     | `audio.upgrade`                                    | Same audio formats                                | About 0.7–0.9 seconds; no leading silence; volume 0–1                                       |
| Upgrade icons    | `upgradeIcons.power`, `.chain`, `.charge`, `.heal` | SVG, PNG, or WebP                                 | Square, transparent background; displayed at 32 × 32 CSS pixels                             |
| Browser icon     | `public/favicon.svg`                               | SVG                                               | Clear at 16 and 32 pixels; this follows the browser's standard path                         |

## Model orientation and size

- Use **+Y up, +Z toward the camera**, with the cat's face looking along +Z.
- Apply transforms before export. Deliver one self-contained GLB, with no external texture or decoder dependencies. Use ordinary, uncompressed glTF geometry; Draco, Meshopt, and KTX2 decoders are not configured.
- The importer centers the model's bounding box and scales the cat to `cat.height` (default **1.8 world units**). Earth has a radius of 1.45. Keep tails/ears inside the intended export bounds. The normalization uses the exported rest pose.
- Asteroids are centered and normalized to a diameter of 2, then scaled by their gameplay radius. Do not bake collision sizes into the asset. Their collision spheres remain controlled by the simulation.
- The game handles orbiting, leaning, swat travel, and screen positioning. Cat animation clips should stay **in place**, with no root motion.
- `Idle` loops. `Swat`, `Celebrate`, and `Mrow` play once and blend back to Idle. Clips are optional; a static cat still orbits and swats through the game's transforms.
- Aim for a 0.25–0.3-second swat, 1.2–2-second celebration, and 0.7–0.9-second upgrade reaction.
- Standard glTF PBR materials, embedded PNG/JPG textures, and one texture atlas are preferred. Avoid relying on custom shaders or very thin transparent details on a phone.

## Example replacement

Place `cat-v2.glb` in `public/assets/models/`, then change only:

```json
"cat": {
  "model": "/assets/models/cat-v2.glb",
  "height": 1.8,
  "clips": { "idle": "Idle", "swat": "Swat", "celebrate": "Celebrate", "upgrade": "Mrow" }
}
```

For a recorded upgrade sound, place `mrow.mp3` in `public/assets/audio/` and set `audio.upgrade.url` to `/assets/audio/mrow.mp3`. Start with volume 0.6. Mute stops active vocals as well as preventing new ones.

## Validate a handoff

1. Run `pnpm check:assets` to check file paths, nonempty files, and GLB version headers.
2. Run `pnpm test` for gameplay/asset-contract regressions.
3. Run `pnpm dev` and open the local URL. Verify the front-facing pose, idle motion, fast repeated swats, completion, and upgrade reaction.
4. Check a narrow phone viewport and actual phone hardware. Make sure asteroid variants remain distinct and UI icons have sufficient contrast.
5. Check the browser console for asset warnings. The file checker does not certify materials, animation tracks, triangle budgets, or appearance.

Accelerated WebGL uses the custom GLBs. On devices without WebGL 2, the compatibility renderer deliberately uses the lightweight built-in cat and asteroid geometry; the replacement planet texture and audio still apply. This avoids expensive or unsupported skeletal/PBR rendering in software.

## Code map

- `assets.ts`: validated manifest and defaults.
- `models.ts`: GLB loading, centering, instancing, animation playback, and disposal.
- `procedural-cat.ts`: existing cat placeholder, isolated from gameplay.
- `scene.ts`: presentation, camera, lights, effects, and default asteroids.
- `audio.ts`: sample playback, mute/cleanup, and synthesis fallback.
- `simulation.ts`: rules and state transitions; artwork does not change them.

Current vocals are original synthesized placeholders, generated by `python scripts/generate-cat-audio.py`. Replace the WAVs with your own licensed recordings for a more natural voice. Please include a short credit/license note with commissioned assets.
