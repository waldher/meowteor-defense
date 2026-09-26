"use client";
import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  ArrowUpRight,
  Orbit,
  RotateCcw,
  Shield,
  MousePointer2,
  Sparkles,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Game, UPGRADES } from "@/lib/game/simulation";
import type { SpaceScene } from "@/lib/game/scene";
import { AudioFX } from "@/lib/game/audio";
import { DEFAULT_ASSETS, loadManifest } from "@/lib/game/assets";
import { ModelAssets } from "@/lib/game/models";
const initial = new Game().snapshot();
export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<SpaceScene | null>(null),
    game = useRef<Game | null>(null),
    audio = useRef<AudioFX | null>(null);
  const [assets, setAssets] = useState(DEFAULT_ASSETS),
    [state, setState] = useState(initial),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [muted, setMuted] = useState(false),
    [best, setBest] = useState(0),
    [help, setHelp] = useState(false),
    [targets, setTargets] = useState<
      {
        id: number;
        x: number;
        y: number;
        size: number;
        kind: string;
        hp: number;
      }[]
    >([]),
    [floats, setFloats] = useState<
      {
        id: number;
        x: number;
        y: number;
        text: string;
        color: string;
        end: number;
      }[]
    >([]);
  const [notice, setNotice] = useState(""),
    [fps, setFps] = useState(60);
  const saved = useRef(0);
  const pointerSwat = useRef<number | null>(null);
  const sync = () => {
    if (game.current) setState(game.current.snapshot());
  };
  useEffect(() => {
    let stopped = false,
      raf = 0,
      timer: ReturnType<typeof setTimeout> | undefined,
      last = 0,
      uiClock = 0,
      frameCount = 0,
      perfClock = 0,
      floatId = 0;
    const g = new Game();
    game.current = g;
    const sound = new AudioFX();
    audio.current = sound;
    try {
      const b = Number(localStorage.getItem("orbital-cat-best") || 0);
      if (Number.isFinite(b)) {
        setBest(b);
        saved.current = b;
      }
      sound.enabled = localStorage.getItem("orbital-cat-muted") !== "1";
      setMuted(!sound.enabled);
    } catch {}
    const visibility = () => {
      if (document.hidden) sound.stop();
      if (document.hidden && g.mode === "playing") {
        g.pause();
        sync();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    Promise.all([import("@/lib/game/scene"), loadManifest()])
      .then(async ([{ SpaceScene }, pack]) => {
        if (stopped || !canvas.current) return;
        sound.configure(pack);
        setAssets(pack);
        const models = await new ModelAssets(pack).load();
        if (stopped || !canvas.current) {
          models.dispose();
          return;
        }
        try {
          const scene = new SpaceScene(
            canvas.current,
            g,
            () => {
              g.mode = "paused";
              sync();
              setError(
                "The graphics connection was interrupted. Reload to reconnect.",
              );
            },
            pack,
            models,
          );
          engine.current = scene;
          setReady(true);
          const loop = (now: number) => {
            if (stopped) return;
            const elapsed = last ? (now - last) / 1000 : 0;
            const dt = Math.min(elapsed, 0.05);
            last = now;
            if (!document.hidden) {
              try {
                let remaining = Math.min(elapsed, 0.25);
                while (remaining > 0) {
                  const step = Math.min(remaining, 0.05);
                  g.tick(step);
                  remaining -= step;
                }
                const events = g.events.splice(0);
                for (const e of events) {
                  scene.effect(e);
                  sound.play(e.type);
                  if (e.text) {
                    const p = scene.point(e.x, e.y);
                    const f = {
                      id: floatId++,
                      x: p.x,
                      y: p.y,
                      text: e.text,
                      color: e.color,
                      end: now + 950,
                    };
                    setFloats((old) => [...old.slice(-7), f]);
                  }
                }
                scene.render(g.mode === "paused" ? 0 : dt);
                uiClock += dt;
                perfClock += elapsed;
                frameCount++;
                if (perfClock >= 1) {
                  setFps(Math.round(frameCount / perfClock));
                  frameCount = 0;
                  perfClock = 0;
                }
                if (uiClock > 0.04) {
                  uiClock = 0;
                  setState(g.snapshot());
                  setTargets(
                    g.rocks.map((r) => {
                      const p = scene.point(r.x, r.y, 0.1);
                      const edge = scene.point(r.x + r.radius, r.y, 0.1);
                      return {
                        id: r.id,
                        x: p.x,
                        y: p.y,
                        size: Math.max(44, Math.abs(edge.x - p.x) * 2 + 12),
                        kind: r.kind,
                        hp: r.hp,
                      };
                    }),
                  );
                  setFloats((old) => old.filter((f) => f.end > now));
                  if (g.mode === "over" && g.score > saved.current) {
                    saved.current = g.score;
                    setBest(g.score);
                    try {
                      localStorage.setItem("orbital-cat-best", String(g.score));
                    } catch {}
                  }
                }
              } catch (err) {
                console.error(err);
                setError(
                  err instanceof Error ? err.message : "Rendering interrupted",
                );
                return;
              }
            }
            if (scene.software)
              timer = setTimeout(() => loop(performance.now()), 33);
            else raf = requestAnimationFrame(loop);
          };
          raf = requestAnimationFrame(loop);
        } catch {
          setError(
            "This game needs WebGL 2. Try a current browser with hardware acceleration enabled.",
          );
        }
      })
      .catch(() =>
        setError("The game could not load. Please reload to try again."),
      );
    const keys = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "KeyP") {
        g.pause();
        sync();
      }
      if (e.code === "Space") {
        e.preventDefault();
        sound.unlock();
        g.purr();
        sync();
      }
      if (e.code === "Enter" && g.mode === "menu") {
        sound.unlock();
        g.start();
        sync();
      }
    };
    window.addEventListener("keydown", keys);
    const mc = (
        document as Document & { modelContext?: { registerTool: Function } }
      ).modelContext,
      controller = new AbortController();
    if (mc?.registerTool) {
      for (const tool of [
        {
          name: "read_meowteor_defense",
          description: "Read the current Meowteor Defense game status.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => g.snapshot(),
        },
        {
          name: "control_meowteor_defense",
          description:
            "Start a new game from the menu or game-over screen, or pause/resume the current game.",
          inputSchema: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["start", "pause", "resume"] },
            },
            required: ["action"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: unknown) => {
            const action = (input as { action?: string })?.action;
            if (!["start", "pause", "resume"].includes(action || ""))
              throw new Error("Invalid action");
            if (action === "start") {
              if (!["menu", "over"].includes(g.mode))
                throw new Error("A run is already active");
              g.start();
            } else if (action === "pause" && g.mode === "playing") g.pause();
            else if (action === "resume" && g.mode === "paused") g.pause();
            else throw new Error("Action unavailable in this game state");
            sync();
            return g.snapshot();
          },
        },
      ]) {
        try {
          void Promise.resolve(
            mc.registerTool(tool, { signal: controller.signal }),
          ).catch(() => {});
        } catch {}
      }
    }
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("keydown", keys);
      engine.current?.dispose();
      sound.dispose();
    };
  }, []);
  const start = () => {
    pointerSwat.current = null;
    audio.current?.stop();
    audio.current?.unlock();
    game.current?.start();
    setHelp(false);
    setFloats([]);
    setTargets([]);
    sync();
  };
  const swat = (x: number, y: number) => {
    audio.current?.unlock();
    game.current?.swat(x, y);
    sync();
  };
  const target = (id: number) => {
    const r = game.current?.rocks.find((r) => r.id === id);
    if (r) swat(r.x, r.y);
  };
  const purr = () => {
    audio.current?.unlock();
    if (!game.current?.purr()) {
      setNotice("Swat asteroids to charge your purr");
      setTimeout(() => setNotice(""), 1600);
    }
    sync();
  };
  const mute = () => {
    if (!audio.current) return;
    audio.current.enabled = !audio.current.enabled;
    setMuted(!audio.current.enabled);
    audio.current.unlock();
    try {
      localStorage.setItem(
        "orbital-cat-muted",
        audio.current.enabled ? "0" : "1",
      );
    } catch {}
  };
  const active = state.mode === "playing" || state.mode === "paused";
  return (
    <main
      data-swats={state.swats}
      data-hits={state.hits}
      className={"game " + (state.mode === "menu" ? "is-menu" : "")}
    >
      <div className="space-glow" aria-hidden="true" />
      <canvas
        ref={canvas}
        className="universe"
        aria-label="3D Earth and its guardian cat"
        onPointerDown={(e) => {
          if (state.mode === "playing" && engine.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            const p = engine.current.unproject(
              e.clientX - rect.left,
              e.clientY - rect.top,
            );
            swat(p.x, p.y);
          }
        }}
      />
      <header className="masthead">
        <a className="brand" href="/" aria-label="Meowteor Defense home">
          <Orbit size={24} />
          <span>
            MEOWTEOR<span className="brand-cat">DEFENSE</span>
          </span>
        </a>
        <div className="top-right">
          {state.mode === "menu" && (
            <span className="edition">EARTH DEFENSE DIVISION</span>
          )}
          <button
            className="icon-button"
            onClick={mute}
            aria-label={muted ? "Enable sound" : "Mute sound"}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          {active && (
            <button
              className="icon-button"
              aria-label={
                state.mode === "paused" ? "Resume game" : "Pause game"
              }
              onClick={() => {
                game.current?.pause();
                sync();
              }}
            >
              {state.mode === "paused" ? (
                <Play size={19} />
              ) : (
                <Pause size={19} />
              )}
            </button>
          )}
        </div>
      </header>
      {state.mode === "menu" && !error && (
        <>
          <section className="intro">
            <div className="eyebrow">
              <span /> THE LAST LINE OF DEFENSE
            </div>
            <h1>
              Small planet.
              <br /> <em>Big cat.</em>
            </h1>
            <p>
              Extinction is coming.
              <br /> Fortunately, someone has paws.
            </p>
            <button className="launch" disabled={!ready} onClick={start}>
              {ready ? "Defend Pawlenet Earth" : "Entering orbit…"}
              <ArrowUpRight size={24} />
            </button>
            <div className="intro-controls">
              <MousePointer2 size={16} />
              <span>Tap or click asteroids to swat.</span>
            </div>
            <button className="text-button" onClick={() => setHelp(!help)}>
              {help ? "Got it" : "Flight briefing"}{" "}
              <span>{help ? "−" : "+"}</span>
            </button>
            {help && (
              <div className="briefing">
                <p>
                  <strong>Swat anywhere.</strong> Tap an asteroid and your cat
                  leaps to it. Time hits inside the green rings for double
                  points.
                </p>
                <p>
                  <strong>Build a streak.</strong> Quick hits raise your
                  multiplier. Nearby rocks can chain together.
                </p>
                <p>
                  <strong>Super Purr.</strong> Fill the meter, then tap it or
                  press Space to clear danger. P or Esc pauses.
                </p>
              </div>
            )}
          </section>
          <div className="planet-label">
            <span className="crosshair">+</span>
            <div>
              PAWLENET EARTH <small>8 BILLION REASONS TO SWAT</small>
            </div>
          </div>
          <footer className="menu-footer">
            <span>ONE CAT. ONE PLANET. ALL OF US.</span>
            <span>
              PERSONAL BEST <b>{best.toLocaleString().padStart(5, "0")}</b>
            </span>
          </footer>
        </>
      )}
      {active && (
        <>
          <section className="hud" aria-label="Game status">
            <div className="score-block">
              <span className="label">SCORE</span>
              <strong>{state.score.toLocaleString().padStart(5, "0")}</strong>
              <span className="wave-label">
                LEVEL {String(state.wave).padStart(2, "0")}{" "}
                <span> / {state.remaining} incoming</span>
              </span>
            </div>
            <div className="health-block">
              <div>
                <span className="label">
                  <Shield size={13} /> EARTH
                </span>
                <strong
                  style={{ color: state.health < 35 ? "#ff8294" : undefined }}
                >
                  {state.health}%
                </strong>
              </div>
              <Progress
                aria-label="Earth health"
                value={state.health}
                className={
                  "health-meter " + (state.health < 35 ? "danger" : "")
                }
              />
            </div>
          </section>
          {state.mode === "playing" && (
            <div className="targets" aria-label="Asteroids">
              {targets.map((r) => (
                <button
                  key={r.id}
                  className={"asteroid-target " + r.kind}
                  aria-label={`Swat ${r.kind} asteroid ${r.id}`}
                  style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    pointerSwat.current = r.id;
                    target(r.id);
                  }}
                  onClick={(e) => {
                    if (e.detail === 0 || pointerSwat.current !== r.id)
                      target(r.id);
                    pointerSwat.current = null;
                  }}
                >
                  {r.hp > 1 && (
                    <span className="armor-pips">
                      {r.hp > 5 ? r.hp : "•".repeat(r.hp)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <div
            className="wave-announcement"
            key={state.wave}
            aria-live="polite"
          >
            <small>{state.wave % 5 === 0 ? "WARNING" : "INCOMING"}</small>
            <strong>
              {state.wave % 5 === 0
                ? "Extinction event"
                : `Level ${String(state.wave).padStart(2, "0")}`}
            </strong>
            <span>{state.message}</span>
          </div>
          {state.combo >= 3 && (
            <div className="combo">
              <strong>×{Math.min(5, 1 + Math.floor(state.combo / 5))}</strong>
              <span>{state.combo} HIT STREAK</span>
            </div>
          )}
          <footer className="battle-footer">
            <div className="battle-tip">
              {state.wave === 1
                ? "Tap asteroids · Green ring = perfect swat"
                : state.wave === 2
                  ? "Pink meteors split. Swat them early."
                  : state.wave % 5 === 0
                    ? "Big asteroid. Big problem. Keep swatting."
                    : "Keep your streak. Protect your planet."}
            </div>
            <button
              className={
                "purr-button " + (state.charge >= 100 ? "charged" : "")
              }
              onClick={purr}
              aria-label={
                state.charge >= 100
                  ? "Activate Super Purr"
                  : `Super Purr charging ${state.charge}%`
              }
            >
              <span
                className="purr-fill"
                style={{ width: `${state.charge}%` }}
              />
              <Sparkles size={22} />
              <span>
                <strong>SUPER PURR</strong>
                <small>
                  {state.charge >= 100
                    ? "READY TO UNLEASH"
                    : `${state.charge}% CHARGED`}
                </small>
              </span>
              <kbd>SPACE</kbd>
            </button>
            {notice && (
              <div className="notice" role="status">
                {notice}
              </div>
            )}
          </footer>
        </>
      )}
      <div className="floating-layer" aria-hidden="true">
        {floats.map((f) => (
          <span
            key={f.id}
            className="floating-score"
            style={{ left: f.x, top: f.y, color: f.color }}
          >
            {f.text}
          </span>
        ))}
      </div>
      {state.mode === "paused" && !error && (
        <section className="overlay">
          <div className="panel pause-panel">
            <div className="eyebrow">CATNAP IN PROGRESS</div>
            <h2>
              Still got
              <br />
              <em>your back.</em>
            </h2>
            <p>Earth can wait a moment.</p>
            <button
              className="launch"
              onClick={() => {
                game.current?.pause();
                sync();
              }}
            >
              Back to orbit <Play size={19} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                if (game.current) game.current.mode = "menu";
                setTargets([]);
                sync();
              }}
            >
              End run & return home
            </button>
          </div>
        </section>
      )}
      {state.mode === "celebrating" && (
        <div className="complete-ribbon" role="status">
          <span className="eyebrow">PAWLENET EARTH IS SAFE</span>
          <strong>Level complete</strong>
          <span className="purr-caption">Prrrrr… good kitty.</span>
        </div>
      )}
      {state.mode === "summary" && state.summary && (
        <section className="overlay summary-overlay">
          <div className="panel summary-panel">
            <div className="eyebrow">
              LEVEL {String(state.summary.level).padStart(2, "0")} · COMPLETE
            </div>
            <h2>
              A little purr.
              <br />
              <em>A big relief.</em>
            </h2>
            <p>
              {state.summary.damage === 0
                ? "Not a scratch on Pawlenet Earth."
                : `Pawlenet Earth is safe. ${state.summary.health}% health remaining.`}
            </p>
            <div className="level-results">
              <div>
                <b>{state.summary.kills}</b>
                <span>ASTEROIDS SWATTED</span>
              </div>
              <div>
                <b>{state.summary.perfect}</b>
                <span>PERFECT SWATS</span>
              </div>
              <div>
                <b>{state.summary.bestCombo}</b>
                <span>BEST STREAK</span>
              </div>
              <div>
                <b>{state.summary.seconds}s</b>
                <span>LEVEL TIME</span>
              </div>
            </div>
            <div className="level-points">
              <span>
                Points earned <b>{state.summary.points.toLocaleString()}</b>
              </span>
              <span>
                Level bonus <b>+{state.summary.bonus.toLocaleString()}</b>
              </span>
              <span className="level-total">
                Run total <b>{state.score.toLocaleString()}</b>
              </span>
            </div>
            <button
              className="launch"
              onClick={() => {
                audio.current?.unlock();
                game.current?.showUpgrades();
                sync();
              }}
            >
              Choose upgrade <ArrowUpRight size={21} />
            </button>
            <span className="summary-hint">
              Take a breath. The next level waits for you.
            </span>
          </div>
        </section>
      )}
      {state.mode === "ready" && (
        <div className="ready-banner" role="status">
          <strong>Mrow!</strong>
          <span>
            {state.selectedUpgrade}
            {state.selectedUpgrade === "All systems ready" ? "" : " equipped"}
          </span>
          <small>LEVEL {String(state.wave + 1).padStart(2, "0")} UP NEXT</small>
        </div>
      )}
      {state.mode === "upgrade" && (
        <section className="overlay">
          <div className="panel upgrade-panel">
            <div className="eyebrow">PAWLENET SAVED · LEVEL {state.wave}</div>
            <h2>
              Good kitty.
              <br />
              <em>Get stronger.</em>
            </h2>
            <p>Choose one upgrade for the next level.</p>
            <div className="upgrade-grid">
              {UPGRADES.map((u) => {
                const level = u.id === "heal" ? 0 : state.upgrades[u.id];
                const max = u.id === "heal" ? state.health === 100 : level >= 3;
                return (
                  <button
                    className="upgrade-card"
                    disabled={max}
                    key={u.id}
                    onClick={() => {
                      audio.current?.unlock();
                      game.current?.choose(u.id);
                      sync();
                    }}
                  >
                    <span className="upgrade-icon">
                      {assets.upgradeIcons[u.id] ? (
                        <img
                          src={assets.upgradeIcons[u.id]!}
                          alt=""
                          width="32"
                          height="32"
                        />
                      ) : (
                        u.icon
                      )}
                    </span>
                    <strong>{u.name}</strong>
                    <span>{u.description}</span>
                    <small>
                      {max
                        ? u.id === "heal"
                          ? "EARTH AT FULL HEALTH"
                          : "MAX LEVEL"
                        : u.id === "heal"
                          ? `EARTH ${state.health}% → ${Math.min(100, state.health + 30)}%`
                          : `LEVEL ${level + 1} / 3`}{" "}
                      <ArrowUpRight size={14} />
                    </small>
                  </button>
                );
              })}
            </div>
            {Object.values(state.upgrades).every((l) => l === 3) &&
              state.health === 100 && (
                <button
                  className="launch"
                  onClick={() => {
                    game.current?.continueWithoutUpgrade();
                    sync();
                  }}
                >
                  Next level <ArrowUpRight size={20} />
                </button>
              )}
            <div className="upgrade-score">
              +{state.wave * 250} LEVEL BONUS <span>·</span>{" "}
              {state.score.toLocaleString()} TOTAL POINTS
            </div>
          </div>
        </section>
      )}
      {state.mode === "over" && (
        <section className="overlay">
          <div className="panel over-panel">
            <div className="eyebrow">A VALIANT LAST SWAT</div>
            <h2>
              Not on
              <br />
              <em>your next watch.</em>
            </h2>
            <p>
              Made it to level {state.wave}. The universe demands a rematch.
            </p>
            <div className="final-score">
              <span>FINAL SCORE</span>
              <strong>{state.score.toLocaleString()}</strong>
              {state.score >= best && state.score > 0 && (
                <small>NEW PERSONAL BEST</small>
              )}
            </div>
            <div className="run-stats">
              <div>
                <b>{state.kills}</b>
                <span>ASTEROIDS</span>
              </div>
              <div>
                <b>{state.bestCombo}</b>
                <span>BEST STREAK</span>
              </div>
              <div>
                <b>{state.perfect}</b>
                <span>PERFECT SWATS</span>
              </div>
            </div>
            <button className="launch" onClick={start}>
              One more life <RotateCcw size={20} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                if (game.current) game.current.mode = "menu";
                setTargets([]);
                sync();
              }}
            >
              Return home
            </button>
          </div>
        </section>
      )}
      {error && (
        <section className="overlay">
          <div className="panel">
            <h2>Lost in space?</h2>
            <p>{error}</p>
            <button className="launch" onClick={() => location.reload()}>
              Reload game <RotateCcw size={20} />
            </button>
          </div>
        </section>
      )}
      <output className="performance" aria-label="Rendering performance">
        {fps} FPS · {Math.floor(state.time)}s
      </output>
    </main>
  );
}
