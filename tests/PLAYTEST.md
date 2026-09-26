# Meowteor Defense validation — 26 September 2026

## Automated simulation

Seven Node test cases passed. A deterministic skilled-player run completed 20 waves, including four bosses, 798 asteroid kills, and 508,150 points. Tests cover pause invariance, attack cooldown, armor, perfect bonuses, meteor splitting, charged purr behavior, upgrade validation, loss, and a clean restart.

Run: `node --experimental-strip-types --test tests/game.test.ts`

## Browser interaction

Tested the actual game through semantic buttons and pointer clicks in desktop (1363 × 936) and embedded phone (390 × 844) viewports.

- Start, swat, visible score increments, Earth damage, and wave completion.
- Desktop wave one reached its reward screen with 1,350 points and 80% Earth health.
- Phone wave one reached its reward screen with 1,750 points and 70% health.
- Purr engine selection entered wave two with the existing score, health, and charge preserved.
- Game-over statistics and local personal best appeared; restart reset the run.
- Pause froze the run clock at 3 seconds; the resume button returned to play.
- A focused temporary development encounter confirmed the charged Purr button cleared small threats, left a damaged boss, and reset its charge to zero. That fixture was removed before publication.
- Visual inspection of the desktop scene, phone start screen, and 2 × 2 phone upgrade grid.

## Fixes from testing

- Added the official Three.js SVG compatibility renderer when WebGL 2 is unavailable.
- Reduced compatibility mesh complexity and precision.
- Separated elapsed simulation time from frame rendering, with bounded catch-up steps.
- Corrected scene stacking so labels remain visible in the compatibility renderer.
- Enlarged the character on the phone start screen and corrected text spacing.

## Limitations

The cloud test browser disables WebGL. Browser interaction tests used the software renderer; accelerated rendering and physical-device touch/GPU performance remain unverified. Software rendering measured roughly 11–19 FPS in this remote environment and is only a compatibility mode. The normal renderer uses antialiasing and caps device pixel ratio at 1.7.

WebMCP registration is feature-detected. The permitted browser reported no available tools, so WebMCP execution validation was unavailable.

## Completion and artist-pack update

Fourteen automated tests cover the gameplay, completion timing, one-time rewards and vocal events, waiting for player input, upgrade transitions, per-level statistics, manifest validation, model normalization, and loading a real self-contained GLB into independent instances. The revised 20-level bot run completed four bosses with 798 kills and 407,250 points. Combos now reset per level.

Browser checks verified the purr celebration flows into a persistent Level complete summary, Choose upgrade opens upgrades, and Heavy paws shows Mrow before level two starts. Desktop and 390 × 844 phone summaries fit without clipping. A targeted desktop encounter confirmed clicking a visible asteroid produces one kill and the expected summary points. Temporary completion fixtures and the phone harness were removed before publication.

The supplied vocal WAVs are original synthesized placeholders. Audio event routing and asset files were checked; audible speaker playback was not independently verified in the remote browser. The accelerated renderer limitation above still applies.
