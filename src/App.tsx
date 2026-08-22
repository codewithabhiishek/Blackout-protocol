import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type HudData, type GameEvent, type OverStats } from "./game/engine";
import { sfx } from "./game/audio";

/* ------------------------------------------------------------------ */

const HUD0: HudData = {
  hp: 100, mag: 30, magSize: 30, score: 0, kills: 0, wave: 1,
  enemies: 0, mult: 1, rapid: 0, reloading: false,
  weapon: "PHANTOM MK-IV", muted: false, crouched: false,
};

interface FeedItem { id: number; text: string; color: string }
interface Banner { title: string; sub: string; n: number }
type Screen = "menu" | "play" | "paused" | "over";

const BEST_KEY = "blackout_protocol_best";

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Animated menu backdrop — radar sweep, perspective grid, embers      */
/* ------------------------------------------------------------------ */

function MenuBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0, W = 0, H = 0, t = 0, last = performance.now();
    const embers = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random(),
      s: 0.5 + Math.random() * 1.6,
      v: 0.015 + Math.random() * 0.05,
      a: 0.2 + Math.random() * 0.5,
      warm: Math.random() > 0.4,
    }));
    const resize = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.fillStyle = "#04070a";
      ctx.fillRect(0, 0, W, H);

      const hor = H * 0.44;
      /* floor glow */
      const grd = ctx.createLinearGradient(0, hor, 0, H);
      grd.addColorStop(0, "#060d08");
      grd.addColorStop(1, "#0e1c11");
      ctx.fillStyle = grd;
      ctx.fillRect(0, hor, W, H - hor);

      /* perspective grid, scrolling */
      ctx.lineWidth = 1;
      const rows = 13;
      for (let i = 0; i < rows; i++) {
        const p = ((i + ((t * 0.55) % 1)) / rows);
        const y = hor + (H - hor) * p * p;
        ctx.strokeStyle = `rgba(154,205,50,${(0.03 + p * 0.09).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      for (let i = -10; i <= 10; i++) {
        const xB = W / 2 + i * (W / 9);
        const xT = W / 2 + i * (W / 60);
        ctx.strokeStyle = "rgba(154,205,50,0.05)";
        ctx.beginPath();
        ctx.moveTo(xT, hor);
        ctx.lineTo(xB, H);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,176,46,0.10)";
      ctx.fillRect(0, hor - 1, W, 2);

      /* radar */
      const rx = W * 0.76, ry = H * 0.38, rr = Math.min(W, H) * 0.3;
      ctx.strokeStyle = "rgba(255,176,46,0.10)";
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(rx, ry, (rr * i) / 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(rx - rr, ry); ctx.lineTo(rx + rr, ry);
      ctx.moveTo(rx, ry - rr); ctx.lineTo(rx, ry + rr);
      ctx.stroke();
      const sweep = (t * 1.1) % (Math.PI * 2);
      for (let i = 0; i < 26; i++) {
        const a = sweep - i * 0.028;
        const al = 0.16 * (1 - i / 26);
        ctx.strokeStyle = `rgba(255,176,46,${al.toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + Math.cos(a) * rr, ry + Math.sin(a) * rr);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const ba = sweep - 0.5 - i * 0.9;
        const bd = rr * (0.25 + ((i * 37) % 60) / 85);
        const fade = Math.max(0, 1 - ((sweep - ba) % (Math.PI * 2)) / 2.4);
        ctx.fillStyle = `rgba(255,90,70,${(0.5 * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(rx + Math.cos(ba) * bd, ry + Math.sin(ba) * bd, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      /* embers */
      for (const e of embers) {
        e.y -= e.v * dt;
        if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
        ctx.fillStyle = e.warm
          ? `rgba(255,176,46,${(e.a * 0.5).toFixed(3)})`
          : `rgba(154,205,50,${(e.a * 0.35).toFixed(3)})`;
        ctx.fillRect(e.x * W, e.y * H, e.s, e.s);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function CrosshairIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Ctrl({ k, label }: { k: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 py-[7px] last:border-0">
      <span className="text-[13px] font-semibold tracking-[0.18em] text-ghost">{label}</span>
      <span className="kbd">{k}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const idRef = useRef(0);
  const bannerTimeout = useRef(0);

  const [screen, setScreen] = useState<Screen>("menu");
  const [hud, setHud] = useState<HudData>(HUD0);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [stats, setStats] = useState<OverStats | null>(null);
  const [best, setBest] = useState<number>(() => Number(localStorage.getItem(BEST_KEY) ?? 0));
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const mini = miniRef.current!;
    const handleEvent = (e: GameEvent) => {
      if (e.type === "feed") {
        const id = ++idRef.current;
        setFeed((f) => [...f.slice(-4), { id, text: e.text, color: e.color }]);
        window.setTimeout(() => setFeed((f) => f.filter((x) => x.id !== id)), 3000);
      } else if (e.type === "banner") {
        const n = ++idRef.current;
        setBanner({ title: e.title, sub: e.sub, n });
        window.clearTimeout(bannerTimeout.current);
        bannerTimeout.current = window.setTimeout(() => setBanner(null), 2700);
      } else if (e.type === "over") {
        setStats(e.stats);
        setScreen("over");
        setBest((prev) => {
          const b = Math.max(prev, e.stats.score);
          localStorage.setItem(BEST_KEY, String(b));
          return b;
        });
      } else if (e.type === "pause") {
        setScreen("paused");
      } else if (e.type === "resume") {
        setScreen("play");
      }
    };
    const game = new Game(canvas, mini, (h) => setHud(h), handleEvent);
    gameRef.current = game;
    setMuted(sfx.muted);
    return () => {
      window.clearTimeout(bannerTimeout.current);
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const deploy = useCallback(() => {
    sfx.unlock();
    sfx.ui();
    setFeed([]);
    setStats(null);
    setBanner(null);
    setScreen("play");
    gameRef.current?.startGame();
    gameRef.current?.requestLock();
  }, []);

  const resume = useCallback(() => {
    sfx.ui();
    gameRef.current?.resumeGame();
  }, []);

  const restart = useCallback(() => {
    sfx.ui();
    setFeed([]);
    setBanner(null);
    setScreen("play");
    gameRef.current?.startGame();
    gameRef.current?.requestLock();
  }, []);

  const quit = useCallback(() => {
    sfx.ui();
    setFeed([]);
    setBanner(null);
    gameRef.current?.quitToMenu();
    setScreen("menu");
  }, []);

  const toggleMute = useCallback(() => {
    const m = gameRef.current?.toggleMute() ?? false;
    setMuted(m);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Enter") return;
      if (screen === "menu") deploy();
      else if (screen === "over") restart();
      else if (screen === "paused") resume();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, deploy, restart, resume]);

  const inGame = screen !== "menu";
  const hpColor = hud.hp <= 30 ? "#ff3b30" : hud.hp <= 60 ? "#ffb02e" : "#9acd32";

  return (
    <div
      className={`relative h-screen w-screen overflow-hidden bg-ink font-body select-none ${screen === "play" ? "cursor-none" : ""}`}
      onClick={() => { if (screen === "play") gameRef.current?.clickCanvas(); }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      <div className="scanlines pointer-events-none absolute inset-0 z-10" />

      {/* ============================ HUD ============================ */}
      {
        <div className={`pointer-events-none absolute inset-0 z-20 ${inGame ? "" : "hidden"}`}>
          {/* kill feed */}
          <div className="absolute left-4 top-4 flex flex-col items-start gap-1.5">
            {feed.map((f) => (
              <div
                key={f.id}
                className="anim-feed chamfer-sm border-l-2 bg-black/55 px-3 py-1 text-[13px] font-bold tracking-[0.16em]"
                style={{ color: f.color, borderLeftColor: f.color }}
              >
                {f.text}
              </div>
            ))}
            {hud.muted && (
              <div className="chamfer-sm bg-black/55 px-3 py-1 text-[11px] font-bold tracking-[0.22em] text-ghost">
                AUDIO OFF — M
              </div>
            )}
          </div>

          {/* hostiles counter */}
          {screen === "play" && (
            <div className="absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1.5">
              <div className="chamfer-sm bg-black/45 px-5 py-1.5 text-[13px] font-semibold tracking-[0.34em] text-ghost">
                HOSTILES&nbsp;&nbsp;<span className="font-bold text-blood">{String(hud.enemies).padStart(2, "0")}</span>
              </div>
              {hud.crouched && (
                <div className="chamfer-sm border border-acid/40 bg-black/55 px-3 py-0.5 text-[10px] font-bold tracking-[0.28em] text-acid">
                  CROUCHED — STEADY AIM
                </div>
              )}
            </div>
          )}

          {/* minimap + score */}
          <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
            <div className="chamfer border border-line bg-panel/85 p-1.5">
              <canvas ref={miniRef} width={148} height={148} className="block h-[148px] w-[148px]" />
            </div>
            <div className="chamfer-sm flex overflow-hidden border border-line">
              {[
                { l: "SCORE", v: hud.score.toLocaleString(), c: "text-brass" },
                { l: "KILLS", v: String(hud.kills), c: "text-white" },
                { l: "WAVE", v: String(hud.wave).padStart(2, "0"), c: "text-white" },
                { l: "CHAIN", v: hud.mult > 1 ? `×${hud.mult}` : "—", c: hud.mult > 1 ? "text-acid" : "text-ghost" },
              ].map((s) => (
                <div key={s.l} className="min-w-[74px] border-r border-line bg-panel/85 px-3 py-1.5 text-right last:border-0">
                  <div className="text-[10px] font-semibold tracking-[0.24em] text-ghost">{s.l}</div>
                  <div className={`text-lg font-bold leading-tight tabular-nums ${s.c}`}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* vitals */}
          <div className="absolute bottom-5 left-5">
            <div className="text-[11px] font-semibold tracking-[0.34em] text-ghost">VITALS</div>
            <div
              className={`font-display text-6xl leading-none tabular-nums ${hud.hp <= 30 ? "anim-blink text-blood" : ""}`}
              style={hud.hp > 30 ? { color: hpColor } : undefined}
            >
              {hud.hp}
            </div>
            <div className="chamfer-sm mt-2 h-[14px] w-60 border border-line bg-black/60 p-[2px]">
              <div
                className="h-full transition-[width] duration-200"
                style={{ width: `${hud.hp}%`, background: hpColor }}
              />
            </div>
            {hud.rapid > 0 && (
              <div className="mt-2 w-60">
                <div className="flex justify-between text-[10px] font-bold tracking-[0.26em] text-brass">
                  <span>RAPID FIRE</span>
                  <span>{hud.rapid.toFixed(1)}s</span>
                </div>
                <div className="chamfer-sm mt-1 h-[6px] border border-brassdim bg-black/60 p-[1px]">
                  <div className="h-full bg-brass" style={{ width: `${(hud.rapid / 8) * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* weapon / ammo */}
          <div className="absolute bottom-5 right-5 text-right">
            <div className="text-[11px] font-semibold tracking-[0.34em] text-ghost">{hud.weapon}</div>
            <div className="font-display text-7xl leading-none text-white tabular-nums">
              {String(hud.mag).padStart(2, "0")}
              <span className="text-2xl text-ghost">&nbsp;/ ∞</span>
            </div>
            {hud.reloading ? (
              <div className="anim-blink mt-1.5 text-sm font-bold tracking-[0.3em] text-brass">RELOADING</div>
            ) : hud.mag <= 5 ? (
              <div className="mt-1.5 text-sm font-bold tracking-[0.3em] text-blood">LOW AMMO — R</div>
            ) : (
              <div className="mt-1.5 text-[12px] font-semibold tracking-[0.3em] text-ghost/70">FULL AUTO</div>
            )}
          </div>

          {/* controls hint */}
          {screen === "play" && (
            <div className="anim-hint absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[13px] font-semibold tracking-[0.22em] text-ghost">
              WASD MOVE&ensp;·&ensp;MOUSE AIM&ensp;·&ensp;LMB / RMB FIRE&ensp;·&ensp;R RELOAD&ensp;·&ensp;SHIFT SPRINT&ensp;·&ensp;P PAUSE
            </div>
          )}

          {/* wave banner */}
          {banner && (
            <div key={banner.n} className="pointer-events-none absolute inset-x-0 top-[20%] z-30 text-center">
              <div
                className="anim-banner font-display text-6xl tracking-[0.16em] text-brass md:text-8xl"
                style={{ textShadow: "0 0 34px rgba(255,176,46,0.5), 0 4px 0 rgba(0,0,0,0.6)" }}
              >
                {banner.title}
              </div>
              <div className="anim-banner-sub mt-3 text-base font-bold tracking-[0.6em] text-ghost md:text-lg">
                {banner.sub}
              </div>
            </div>
          )}
        </div>
      }

      {/* ============================ MENU ============================ */}
      {screen === "menu" && (
        <div className="absolute inset-0 z-30 overflow-hidden">
          <MenuBackdrop />
          <div className="scanlines absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/40 to-transparent" />

          <div className="relative flex h-full flex-col justify-between p-8 md:p-14">
            {/* top strip */}
            <div className="anim-rise flex items-center gap-3 text-[11px] font-bold tracking-[0.4em] text-ghost">
              <CrosshairIcon className="h-4 w-4 text-brass" />
              RAYCAST TACTICAL ARENA&nbsp;&nbsp;·&nbsp;&nbsp;BUILD 2.6.1&nbsp;&nbsp;·&nbsp;&nbsp;SECTOR 7 COMPOUND
              <span className="ml-auto hidden items-center gap-2 md:flex">
                <span className="inline-block h-2 w-2 animate-pulse bg-acid" />
                LINK ESTABLISHED
              </span>
            </div>

            {/* main row */}
            <div className="grid flex-1 items-center gap-10 py-6 md:grid-cols-[7fr_5fr]">
              <div>
                <div className="anim-rise anim-rise-1 text-sm font-bold tracking-[0.5em] text-blood">
                  OPERATION FILE // NIGHT DROP
                </div>
                <h1 className="anim-rise anim-rise-1 mt-3 font-display leading-[0.92]">
                  <span className="block text-6xl text-white md:text-8xl" style={{ textShadow: "0 0 40px rgba(154,205,50,0.25), 6px 6px 0 rgba(0,0,0,0.55)" }}>
                    BLACKOUT
                  </span>
                  <span className="stencil-outline block text-5xl md:text-7xl">PROTOCOL</span>
                </h1>
                <p className="anim-rise anim-rise-2 mt-5 max-w-xl text-lg font-medium leading-snug text-ghost">
                  The compound grid went dark at 0300. Hostile squads are flooding the arena in
                  escalating waves. You hold the center. Keep moving, keep firing — and watch
                  your six.
                </p>

                {/* threat intel */}
                <div className="anim-rise anim-rise-3 mt-6 max-w-xl">
                  <div className="mb-2 text-[11px] font-bold tracking-[0.4em] text-brass">THREAT INTEL</div>
                  {[
                    { c: "#ff6b4d", n: "GRUNT", d: "Rifleman. Fires in bursts, keeps distance.", b: "100 PTS" },
                    { c: "#ff3b30", n: "RUNNER", d: "Fast melee rusher. Gets in your face.", b: "150 PTS" },
                    { c: "#ff9f1c", n: "HEAVY", d: "Armored. 3-round bursts. Put it down first.", b: "300 PTS" },
                  ].map((t) => (
                    <div key={t.n} className="chamfer-r mb-1.5 flex items-center gap-4 border border-line bg-panel/70 px-4 py-2 transition-colors hover:border-brassdim hover:bg-panel">
                      <span className="inline-block h-3 w-3 shrink-0" style={{ background: t.c, boxShadow: `0 0 10px ${t.c}` }} />
                      <span className="w-20 font-display text-sm text-white">{t.n}</span>
                      <span className="flex-1 text-[13px] font-medium text-ghost">{t.d}</span>
                      <span className="text-[12px] font-bold tracking-[0.2em] text-brass">{t.b}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* right column */}
              <div className="anim-rise anim-rise-2 flex flex-col gap-4 md:pl-4">
                <div className="chamfer border border-line bg-panel/85 p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-sm tracking-[0.2em] text-white">MISSION PARAMETERS</span>
                    <span className="text-[11px] font-bold tracking-[0.2em] text-acid">ACTIVE</span>
                  </div>
                  <div className="mb-3 grid grid-cols-3 gap-px bg-line">
                    {[
                      { l: "MODE", v: "WAVES" },
                      { l: "AREA", v: "24×24" },
                      { l: "BEST", v: best > 0 ? best.toLocaleString() : "—" },
                    ].map((s) => (
                      <div key={s.l} className="bg-pit px-3 py-2">
                        <div className="text-[10px] font-semibold tracking-[0.24em] text-ghost">{s.l}</div>
                        <div className="text-base font-bold text-white">{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <Ctrl k="W A S D" label="MOVE" />
                  <Ctrl k="MOUSE" label="AIM / LOOK" />
                  <Ctrl k="LMB / RMB" label="FIRE (HOLD)" />
                  <Ctrl k="SPACE" label="JUMP" />
                  <Ctrl k="C / CTRL" label="CROUCH (TOGGLE)" />
                  <Ctrl k="F" label="KNIFE MELEE" />
                  <Ctrl k="R" label="RELOAD" />
                  <Ctrl k="SHIFT" label="SPRINT" />
                  <Ctrl k="P / ESC" label="PAUSE" />
                  <Ctrl k="M" label="MUTE AUDIO" />
                </div>

                <button
                  onClick={deploy}
                  className="chamfer group flex items-center justify-center gap-4 bg-brass px-8 py-5 font-display text-2xl tracking-[0.24em] text-ink transition-all duration-150 hover:bg-white hover:tracking-[0.32em] active:translate-y-[2px]"
                  style={{ boxShadow: "0 0 34px rgba(255,176,46,0.28)" }}
                >
                  <CrosshairIcon className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90" />
                  DEPLOY
                </button>
                <div className="text-center text-[12px] font-semibold tracking-[0.3em] text-ghost">
                  PRESS <span className="kbd">ENTER</span> — CURSOR WILL LOCK TO SIGHTS
                </div>
              </div>
            </div>

            {/* ticker */}
            <div className="anim-rise anim-rise-4 overflow-hidden border-t border-line pt-3">
              <div className="anim-ticker flex w-max gap-16 whitespace-nowrap text-[12px] font-bold tracking-[0.34em] text-ghost/80">
                {[0, 1].map((i) => (
                  <span key={i} className="flex gap-16">
                    <span>INTEL: HOSTILE FORCES MASSING ON THE PERIMETER</span>
                    <span className="text-brass">CHAIN KILLS WITHIN 3s FOR UP TO ×5 SCORE</span>
                    <span>MEDKITS AND RAPID-FIRE CACHES DROP FROM KILLS</span>
                    <span className="text-blood">HEAVIES DETECTED FROM WAVE 03</span>
                    <span>AMMUNITION RESERVES: UNLIMITED — RELOAD DRILL ADVISED</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================ PAUSE ============================ */}
      {screen === "paused" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/85 backdrop-blur-[2px]">
          <div className="chamfer anim-rise w-[440px] max-w-[92vw] border border-line bg-panel/95 p-8">
            <div className="text-[11px] font-bold tracking-[0.4em] text-brass">COMBAT SUSPENDED</div>
            <div className="mt-1 font-display text-4xl text-white">STAND BY</div>
            <p className="mt-2 text-sm font-medium text-ghost">
              Cursor released. Hostiles are holding position — the clock is frozen.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button onClick={resume} className="chamfer-sm bg-brass px-6 py-3 font-display text-lg tracking-[0.22em] text-ink transition-colors hover:bg-white">
                RESUME — P
              </button>
              <button onClick={restart} className="chamfer-sm border border-line bg-pit px-6 py-3 font-display text-base tracking-[0.22em] text-ghost transition-colors hover:border-brassdim hover:text-white">
                RESTART OPERATION
              </button>
              <button onClick={quit} className="chamfer-sm border border-line bg-pit px-6 py-3 font-display text-base tracking-[0.22em] text-ghost transition-colors hover:border-blood hover:text-blood">
                ABORT TO MENU
              </button>
            </div>
            <div className="mt-5 border-t border-line pt-3 text-center text-[12px] font-semibold tracking-[0.26em] text-ghost/70">
              SCORE {hud.score.toLocaleString()}&ensp;·&ensp;WAVE {String(hud.wave).padStart(2, "0")}&ensp;·&ensp;KILLS {hud.kills}
            </div>
          </div>
        </div>
      )}

      {/* ============================ GAME OVER ============================ */}
      {screen === "over" && stats && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/80">
          <div className="w-[560px] max-w-[94vw]">
            <div className="anim-rise text-center">
              <div className="text-[12px] font-bold tracking-[0.5em] text-blood">SIGNAL LOST — OPERATIVE DOWN</div>
              <div
                className="anim-pulse-red font-display text-8xl leading-none text-blood md:text-9xl"
                style={{ textShadow: "0 0 50px rgba(255,59,48,0.45), 6px 6px 0 rgba(0,0,0,0.6)" }}
              >
                K.I.A.
              </div>
              <div className="mt-2 text-base font-bold tracking-[0.44em] text-ghost">OPERATION FAILED</div>
            </div>

            <div className="anim-rise anim-rise-1 chamfer mt-7 border border-line bg-panel/90 p-6">
              <div className="flex items-end justify-between border-b border-line pb-4">
                <div>
                  <div className="text-[11px] font-bold tracking-[0.3em] text-ghost">FINAL SCORE</div>
                  <div className="font-display text-5xl leading-none text-brass tabular-nums">
                    {stats.score.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold tracking-[0.3em] text-ghost">BEST</div>
                  <div className="text-2xl font-bold text-white tabular-nums">{best.toLocaleString()}</div>
                  {stats.score >= best && stats.score > 0 && (
                    <div className="text-[11px] font-bold tracking-[0.24em] text-acid">NEW RECORD</div>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
                {[
                  { l: "KILLS", v: String(stats.kills) },
                  { l: "WAVE", v: String(stats.wave).padStart(2, "0") },
                  { l: "ACCURACY", v: `${stats.accuracy}%` },
                  { l: "SURVIVED", v: fmtTime(stats.time) },
                ].map((s) => (
                  <div key={s.l} className="bg-pit px-4 py-3 text-center">
                    <div className="text-[10px] font-semibold tracking-[0.26em] text-ghost">{s.l}</div>
                    <div className="text-xl font-bold text-white tabular-nums">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="anim-rise anim-rise-2 mt-5 flex gap-3">
              <button onClick={restart} className="chamfer flex-1 bg-brass px-6 py-4 font-display text-xl tracking-[0.22em] text-ink transition-all hover:bg-white active:translate-y-[2px]">
                RE-DEPLOY — ENTER
              </button>
              <button onClick={quit} className="chamfer-r border border-line bg-panel/80 px-6 py-4 font-display text-lg tracking-[0.22em] text-ghost transition-colors hover:border-brassdim hover:text-white">
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
