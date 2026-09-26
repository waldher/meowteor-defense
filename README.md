# Meowteor Defense

A giant cat protects **Pawlenet Earth** from incoming asteroids. Built with Three.js, React, and TypeScript. Tap/click to swat, chain hits, buy upgrades, and unleash a charged Super Purr.

[Play the public game](https://orbital-cat.waldher.chatgpt.site)

## Local development

Requires Node.js 22.13+ and pnpm 11.25.0.

```sh
pnpm install
pnpm dev
```

Open the URL printed by the development server. The portable starter uses port 5173. Builds use Vinext and output a Cloudflare-compatible Worker; the existing public game is hosted through Sites.

```sh
pnpm test
pnpm check:assets
pnpm exec tsc --noEmit
pnpm build
```

## Controls

- Click/tap an asteroid to swat. Hits between the green rings receive a perfect bonus.
- Tap Super Purr or press Space when it is charged.
- P or Escape pauses/resumes.
- Sound toggle and personal best are stored locally on the device. Existing Orbital Cat saves are retained.

## Level flow

Final asteroid → 1.2-second purring celebration → per-level summary → choose an upgrade → brief Mrow reaction → next level. The summary waits for you, and no new threats spawn while choosing an upgrade.

## Graphics and audio

**Start with [the artist handoff](docs/ARTIST-HANDOFF.md).** All replaceable art is selected in [`public/assets/manifest.json`](public/assets/manifest.json). GLB models, planet textures, upgrade icons, and vocal samples can be replaced without editing gameplay code.

`lib/game/simulation.ts` is renderer-independent. `scene.ts`, `models.ts`, `procedural-cat.ts`, and `audio.ts` own presentation. WebGL 2 is preferred; a lightweight software renderer supports devices without it.

## Deployment

The live site retains its current URL and public audience. `.openai/hosting.json` identifies the existing Sites project. The GitHub repository contains the editable source, assets, and tests; GitHub pushes alone do not deploy it. Use the Sites publishing workflow after making changes. Do not commit environment files, credentials, dependencies, or build output.

## Validation

See [the playtest record](tests/PLAYTEST.md) for results and limitations. The cloud browser has no GPU, so actual accelerated rendering and physical-device audio/performance still need a device check.
