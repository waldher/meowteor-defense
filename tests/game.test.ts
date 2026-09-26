import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore Node's type-stripping runner needs the source extension.
import { Game } from "../lib/game/simulation.ts";
const run = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) g.tick(1 / 60);
};
test("idle run ends; restart clears all gameplay state", () => {
  const g = new Game(() => 0.5);
  g.start();
  run(g, 60);
  assert.equal(g.mode, "over");
  assert.equal(g.health, 0);
  g.start();
  assert.equal(g.health, 100);
  assert.equal(g.wave, 1);
  assert.equal(g.score, 0);
  assert.equal(g.rocks.length, 0);
});
test("pause freezes timer, asteroids, score, and attack input", () => {
  const g = new Game(() => 0.5);
  g.start();
  run(g, 3);
  g.pause();
  const before = JSON.stringify(g.snapshot());
  const x = g.rocks[0].x;
  run(g, 10);
  assert.equal(JSON.stringify(g.snapshot()), before);
  assert.equal(g.rocks[0].x, x);
  assert.equal(g.swat(x, 0), false);
  g.pause();
  run(g, 0.5);
  assert.notEqual(g.rocks[0].x, x);
});
test("swats respect cooldown, armor and perfect double scoring", () => {
  const g = new Game();
  g.start();
  const a = g.spawn("iron", 0, 3);
  assert.equal(g.swat(3, 0), true);
  assert.equal(a.hp, 1);
  assert.equal(g.score, 0);
  assert.equal(g.swat(3, 0), false);
  run(g, 0.3);
  assert.equal(g.swat(a.x, a.y), true);
  assert.equal(g.rocks.length, 0);
  assert.equal(g.score, 300);
  assert.equal(g.perfect, 2);
});
test("splitters create two independently moving comets", () => {
  const g = new Game();
  g.start();
  g.spawn("splitter", 0, 4.41);
  run(g, 0.1);
  assert.equal(g.rocks.length, 2);
  assert.ok(g.rocks.every((r) => r.kind === "comet"));
  assert.notEqual(g.rocks[0].y, g.rocks[1].y);
});
test("super purr consumes full charge, damages bosses and clears small rocks", () => {
  const g = new Game();
  g.start();
  g.spawn("rock", 0, 5);
  const b = g.spawn("boss", 2, 7);
  assert.equal(g.purr(), false);
  g.charge = 100;
  assert.equal(g.purr(), true);
  assert.equal(g.charge, 0);
  assert.equal(g.rocks.length, 1);
  assert.equal(b.hp, b.maxHp - 8);
});
test("one reward per wave; invalid and maxed upgrades leave run intact", () => {
  const g = new Game();
  g.start();
  assert.equal(g.choose("power"), false);
  g.mode = "upgrade";
  assert.equal(g.choose("unknown"), false);
  assert.equal(g.choose("power"), true);
  assert.equal(g.mode, "ready");
  assert.equal(g.wave, 1);
  run(g, 1);
  assert.equal(g.wave, 2);
  assert.equal(g.upgrades.power, 1);
  assert.equal(g.choose("power"), false);
  g.mode = "upgrade";
  g.upgrades.power = 3;
  assert.equal(g.choose("power"), false);
  g.health = 80;
  assert.equal(g.choose("heal"), true);
  assert.equal(g.health, 100);
});
test("20-wave skilled playthrough progresses through bosses, upgrades and endless pacing", () => {
  let seed = 42;
  const g = new Game(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  });
  g.start();
  let frames = 0,
    bosses = 0;
  const seen = new Set<number>();
  while (g.wave <= 20 && g.mode !== "over" && frames < 180000) {
    g.tick(1 / 60);
    frames++;
    for (const r of g.rocks)
      if (r.kind === "boss" && !seen.has(r.id)) {
        bosses++;
        seen.add(r.id);
      }
    if (g.cooldown === 0 && g.rocks.length) {
      const r = [...g.rocks].sort(
        (a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y),
      )[0];
      g.swat(r.x, r.y);
    }
    if (g.charge >= 100 && g.rocks.length > 2) g.purr();
    if (g.mode === "summary") g.showUpgrades();
    if (g.mode === "upgrade") {
      if (g.upgrades.power < 3) g.choose("power");
      else if (g.upgrades.chain < 3) g.choose("chain");
      else if (g.upgrades.charge < 3) g.choose("charge");
      else if (g.health < 100) g.choose("heal");
      else g.continueWithoutUpgrade();
    }
    g.events = [];
  }
  assert.equal(g.wave, 21);
  assert.equal(bosses, 4);
  assert.ok(g.score > 100000);
  assert.ok(g.health > 0);
  console.log(
    JSON.stringify({
      frames,
      wave: g.wave,
      score: g.score,
      bosses,
      health: g.health,
      kills: g.kills,
    }),
  );
});

test("level completion purr happens once; summary preserves per-level results and waits for the player", () => {
  const g = new Game();
  g.start();
  g.spawned = g.quota;
  const r = g.spawn("rock", 0, 3);
  g.swat(r.x, r.y);
  g.tick(0.02);
  assert.equal(g.mode, "celebrating");
  assert.equal(g.events.filter((e) => e.type === "levelComplete").length, 1);
  assert.equal(g.summary?.kills, 1);
  assert.equal(g.summary?.perfect, 1);
  assert.equal(g.summary?.points, 200);
  assert.equal(g.summary?.bonus, 250);
  assert.equal(g.score, 450);
  assert.equal(g.choose("power"), false);
  run(g, 2);
  assert.equal(g.mode, "summary");
  const before = JSON.stringify(g.snapshot());
  run(g, 40);
  assert.equal(JSON.stringify(g.snapshot()), before);
  assert.equal(g.events.filter((e) => e.type === "levelComplete").length, 1);
  assert.equal(g.showUpgrades(), true);
  assert.equal(g.showUpgrades(), false);
  assert.equal(g.choose("power"), true);
  assert.equal(g.mode, "ready");
  assert.equal(g.events.filter((e) => e.type === "upgrade").length, 1);
  assert.equal(g.choose("power"), false);
  run(g, 0.5);
  assert.equal(g.wave, 1);
  assert.equal(g.rocks.length, 0);
  run(g, 0.5);
  assert.equal(g.wave, 2);
  assert.equal(g.mode, "playing");
  assert.equal(g.summary, null);
  assert.equal(g.upgrades.power, 1);
});
test("an upgrade cannot leak old hits or scores into the next level summary", () => {
  const g = new Game();
  g.start();
  g.spawned = g.quota;
  let r = g.spawn("rock", 0, 3);
  g.swat(r.x, r.y);
  run(g, 2);
  g.showUpgrades();
  g.choose("power");
  run(g, 1);
  g.spawned = g.quota;
  r = g.spawn("iron", 0, 5);
  g.swat(r.x, r.y);
  run(g, 2);
  assert.equal(g.summary?.level, 2);
  assert.equal(g.summary?.kills, 1);
  assert.equal(g.summary?.points, 150);
  assert.equal(g.summary?.perfect, 0);
  assert.equal(g.summary?.bonus, 500);
});
