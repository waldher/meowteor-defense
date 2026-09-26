export type Mode =
  | "menu"
  | "playing"
  | "paused"
  | "celebrating"
  | "summary"
  | "upgrade"
  | "ready"
  | "over";
export type Kind = "rock" | "iron" | "splitter" | "comet" | "boss";
export type Rock = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  kind: Kind;
  spin: number;
  split: boolean;
  flash: number;
};
export type Effect = {
  type:
    | "swat"
    | "break"
    | "impact"
    | "purr"
    | "spawn"
    | "levelComplete"
    | "upgrade";
  x: number;
  y: number;
  color: string;
  text?: string;
};
export type LevelSummary = {
  level: number;
  seconds: number;
  kills: number;
  perfect: number;
  bestCombo: number;
  accuracy: number;
  points: number;
  bonus: number;
  health: number;
  damage: number;
};
export const UPGRADES = [
  {
    id: "power",
    name: "Heavy paws",
    description: "+1 damage. Crack armored asteroids faster.",
    icon: "✦",
  },
  {
    id: "chain",
    name: "Cosmic claws",
    description: "Wider shockwaves catch nearby asteroids.",
    icon: "⌁",
  },
  {
    id: "charge",
    name: "Purr engine",
    description: "Charge Super Purr 35% faster.",
    icon: "◎",
  },
  {
    id: "heal",
    name: "Planet patch",
    description: "Restore 30 Earth health.",
    icon: "♡",
  },
] as const;
export class Game {
  summary: LevelSummary | null = null;
  transitionTime = 0;
  selectedUpgrade = "";
  waveStart = {
    score: 0,
    kills: 0,
    perfect: 0,
    swats: 0,
    hits: 0,
    health: 100,
  };
  waveBestCombo = 0;
  mode: Mode = "menu";
  wave = 0;
  health = 100;
  score = 0;
  charge = 0;
  combo = 0;
  bestCombo = 0;
  kills = 0;
  swats = 0;
  hits = 0;
  perfect = 0;
  time = 0;
  waveTime = 0;
  cooldown = 0;
  comboTime = 0;
  catAngle = 0.6;
  targetAngle = 0.6;
  leap = 0;
  targetX = 0;
  targetY = 0;
  rocks: Rock[] = [];
  events: Effect[] = [];
  nextId = 1;
  spawnTimer = 0;
  spawned = 0;
  quota = 0;
  bossSpawned = false;
  upgrades = { power: 0, chain: 0, charge: 0 };
  rng: () => number;
  lastMessage = "";
  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }
  start() {
    this.summary = null;
    this.transitionTime = 0;
    this.selectedUpgrade = "";
    this.catAngle = 0.6;
    this.targetAngle = 0.6;
    this.leap = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.nextId = 1;
    this.mode = "playing";
    this.wave = 0;
    this.health = 100;
    this.score = 0;
    this.charge = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.kills = 0;
    this.swats = 0;
    this.hits = 0;
    this.perfect = 0;
    this.time = 0;
    this.cooldown = 0;
    this.comboTime = 0;
    this.rocks = [];
    this.events = [];
    this.upgrades = { power: 0, chain: 0, charge: 0 };
    this.nextWave();
  }
  nextWave() {
    this.waveStart = {
      score: this.score,
      kills: this.kills,
      perfect: this.perfect,
      swats: this.swats,
      hits: this.hits,
      health: this.health,
    };
    this.waveBestCombo = 0;
    this.combo = 0;
    this.summary = null;
    this.selectedUpgrade = "";
    this.wave++;
    this.mode = "playing";
    this.waveTime = 0;
    this.spawnTimer = 1.3;
    this.spawned = 0;
    this.quota = 8 + this.wave * 3;
    this.bossSpawned = false;
    this.comboTime = 0;
    this.lastMessage =
      this.wave % 5 === 0
        ? "EXTINCTION EVENT"
        : this.wave === 1
          ? "Tap asteroids to swat them!"
          : this.wave === 2
            ? "Pink meteors split. Catch them early!"
            : this.wave === 3
              ? "Armored rocks need two swats."
              : `LEVEL ${this.wave}`;
  }
  pause() {
    if (this.mode === "playing") this.mode = "paused";
    else if (this.mode === "paused") this.mode = "playing";
  }
  showUpgrades() {
    if (this.mode !== "summary") return false;
    this.mode = "upgrade";
    return true;
  }
  prepareNext() {
    this.mode = "ready";
    this.transitionTime = 0.95;
    this.cooldown = 0;
    this.leap = 0;
  }
  continueWithoutUpgrade() {
    if (
      this.mode !== "upgrade" ||
      this.health < 100 ||
      Object.values(this.upgrades).some((n) => n < 3)
    )
      return false;
    this.selectedUpgrade = "All systems ready";
    this.prepareNext();
    return true;
  }
  choose(id: string) {
    if (this.mode !== "upgrade") return false;
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade) return false;
    if (id === "heal") {
      if (this.health >= 100) return false;
      this.health = Math.min(100, this.health + 30);
    } else {
      const k = id as keyof typeof this.upgrades;
      if (this.upgrades[k] >= 3) return false;
      this.upgrades[k]++;
    }
    this.selectedUpgrade = upgrade.name;
    this.events.push({ type: "upgrade", x: 0, y: 0, color: "#c1f781" });
    this.prepareNext();
    return true;
  }
  completeLevel() {
    const bonus = this.wave * 250;
    const attempts = this.swats - this.waveStart.swats;
    this.summary = {
      level: this.wave,
      seconds: Math.round(this.waveTime),
      kills: this.kills - this.waveStart.kills,
      perfect: this.perfect - this.waveStart.perfect,
      bestCombo: this.waveBestCombo,
      accuracy: attempts
        ? Math.round(((this.hits - this.waveStart.hits) / attempts) * 100)
        : 0,
      points: this.score - this.waveStart.score,
      bonus,
      health: this.health,
      damage: Math.max(0, this.waveStart.health - this.health),
    };
    this.score += bonus;
    this.mode = "celebrating";
    this.transitionTime = 1.2;
    this.leap = 0;
    this.targetAngle = Math.PI / 2;
    this.events.push({ type: "levelComplete", x: 0, y: 0, color: "#c1f781" });
    this.lastMessage = "LEVEL COMPLETE";
  }
  spawn(kind?: Kind, angle?: number, r = 7.4) {
    const a = angle ?? this.rng() * Math.PI * 2;
    const roll = this.rng();
    const k =
      kind ??
      (this.wave >= 3 && roll < 0.2
        ? "iron"
        : this.wave >= 2 && roll < 0.36
          ? "splitter"
          : this.wave >= 4 && roll > 0.85
            ? "comet"
            : "rock");
    const speed =
      (0.43 + Math.min(this.wave, 18) * 0.065 + this.rng() * 0.12) *
      (k === "comet" ? 1.6 : k === "boss" ? 0.35 : 1);
    const hp = k === "boss" ? 10 + this.wave * 2 : k === "iron" ? 2 : 1;
    const rr =
      k === "boss"
        ? 0.72
        : k === "iron"
          ? 0.32
          : k === "splitter"
            ? 0.3
            : k === "comet"
              ? 0.2
              : 0.25;
    const rock: Rock = {
      id: this.nextId++,
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      vx: -Math.cos(a) * speed,
      vy: -Math.sin(a) * speed,
      radius: rr,
      hp,
      maxHp: hp,
      kind: k,
      spin: this.rng() * 6,
      split: false,
      flash: 0,
    };
    this.rocks.push(rock);
    return rock;
  }
  swat(x: number, y: number) {
    if (this.mode !== "playing" || this.cooldown > 0) return false;
    this.cooldown = 0.28;
    this.swats++;
    this.targetAngle = Math.atan2(y, x);
    this.targetX = x;
    this.targetY = y;
    this.leap = 1;
    this.events.push({ type: "swat", x, y, color: "#ffe8b6" });
    const range = 0.65;
    let target: Rock | undefined,
      dist = Infinity;
    for (const r of this.rocks) {
      const d = Math.hypot(r.x - x, r.y - y);
      if (d < range + r.radius && d < dist) {
        target = r;
        dist = d;
      }
    }
    if (!target) {
      this.combo = 0;
      return false;
    }
    this.hits++;
    const radius = Math.hypot(target.x, target.y);
    const perfect = radius > 2.5 && radius < 3.8;
    if (perfect) this.perfect++;
    this.damage(target, 1 + this.upgrades.power, perfect);
    const chainRadius = 0.72 + this.upgrades.chain * 0.36;
    for (const r of [...this.rocks]) {
      if (r.id !== target.id && Math.hypot(r.x - x, r.y - y) < chainRadius)
        this.damage(r, 1, false);
    }
    return true;
  }
  damage(r: Rock, damage: number, perfect: boolean) {
    if (!this.rocks.includes(r)) return;
    r.hp -= damage;
    r.flash = 0.16;
    if (r.hp > 0) {
      r.x -= r.vx * 0.24;
      r.y -= r.vy * 0.24;
      this.events.push({
        type: "break",
        x: r.x,
        y: r.y,
        color: "#b6c7ff",
        text: "CRACK!",
      });
      return;
    }
    this.rocks = this.rocks.filter((a) => a.id !== r.id);
    this.kills++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.waveBestCombo = Math.max(this.waveBestCombo, this.combo);
    this.comboTime = 3.2;
    const multiplier = Math.min(5, 1 + Math.floor(this.combo / 5));
    const points =
      (r.kind === "boss" ? 1000 : r.kind === "iron" ? 150 : 100) *
      multiplier *
      (perfect ? 2 : 1);
    this.score += points;
    this.charge = Math.min(
      100,
      this.charge + (perfect ? 13 : 8) * (1 + this.upgrades.charge * 0.35),
    );
    this.events.push({
      type: "break",
      x: r.x,
      y: r.y,
      color:
        r.kind === "splitter" ? "#fd7ab4" : perfect ? "#b6ff76" : "#ffbe6c",
      text: perfect ? `PERFECT +${points}` : `+${points}`,
    });
  }
  purr() {
    if (this.mode !== "playing" || this.charge < 100) return false;
    this.events.push({
      type: "purr",
      x: 0,
      y: 0,
      color: "#b6ff76",
      text: "SUPER PURR!",
    });
    for (const r of [...this.rocks]) this.damage(r, 8, false);
    this.charge = 0;
    return true;
  }
  tick(dt: number) {
    dt = Math.min(0.05, Math.max(0, dt));
    if (this.mode === "celebrating" || this.mode === "ready") {
      this.transitionTime = Math.max(0, this.transitionTime - dt);
      if (this.transitionTime <= 0) {
        if (this.mode === "celebrating") this.mode = "summary";
        else this.nextWave();
      }
      return;
    }
    if (this.mode !== "playing") return;
    this.time += dt;
    this.waveTime += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.leap = Math.max(0, this.leap - dt * 3.2);
    if (this.comboTime > 0) {
      this.comboTime -= dt;
      if (this.comboTime <= 0) this.combo = 0;
    }
    this.spawnTimer -= dt;
    if (this.spawned < this.quota && this.spawnTimer <= 0) {
      this.spawn();
      this.spawned++;
      this.spawnTimer = Math.max(0.35, 1.35 - this.wave * 0.07);
      if (this.wave >= 6 && this.spawned % 4 === 0) {
        this.spawn();
        this.spawned++;
      }
    }
    if (this.wave % 5 === 0 && !this.bossSpawned && this.waveTime > 2) {
      this.spawn("boss", Math.PI / 2, 7.5);
      this.bossSpawned = true;
    }
    for (const r of [...this.rocks]) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.flash = Math.max(0, r.flash - dt);
      const d = Math.hypot(r.x, r.y);
      if (r.kind === "splitter" && !r.split && d < 4.4) {
        this.rocks = this.rocks.filter((a) => a.id !== r.id);
        const angle = Math.atan2(r.y, r.x);
        for (const offset of [-0.15, 0.15])
          this.spawn("comet", angle + offset, d);
        this.events.push({
          type: "break",
          x: r.x,
          y: r.y,
          color: "#fd7ab4",
          text: "SPLIT!",
        });
        continue;
      }
      if (d < 1.5 + r.radius * 0.5) {
        this.rocks = this.rocks.filter((a) => a.id !== r.id);
        this.health = Math.max(
          0,
          this.health - (r.kind === "boss" ? 45 : r.kind === "iron" ? 16 : 10),
        );
        this.combo = 0;
        this.events.push({
          type: "impact",
          x: r.x,
          y: r.y,
          color: "#ff5b77",
          text: "EARTH HIT",
        });
        if (this.health <= 0) {
          this.mode = "over";
          break;
        }
      }
    }
    if (
      this.mode === "playing" &&
      this.spawned >= this.quota &&
      this.rocks.length === 0
    ) {
      this.completeLevel();
    }
  }
  snapshot() {
    return {
      summary: this.summary ? { ...this.summary } : null,
      transitionTime: this.transitionTime,
      selectedUpgrade: this.selectedUpgrade,
      mode: this.mode,
      wave: this.wave,
      health: this.health,
      score: this.score,
      charge: Math.floor(this.charge),
      combo: this.combo,
      kills: this.kills,
      bestCombo: this.bestCombo,
      swats: this.swats,
      hits: this.hits,
      perfect: this.perfect,
      time: this.time,
      remaining: Math.max(0, this.quota - this.spawned) + this.rocks.length,
      upgrades: { ...this.upgrades },
      message: this.lastMessage,
    };
  }
}
