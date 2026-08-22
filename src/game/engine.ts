/* BLACKOUT PROTOCOL — raycast FPS engine. All rendering procedural on a 2D canvas. */

import {
  makeWallTextures,
  makeEnemySprites,
  makePickupSprites,
  SW,
  SH,
  type EnemyKind,
} from "./textures";
import { sfx } from "./audio";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface HudData {
  hp: number;
  mag: number;
  magSize: number;
  score: number;
  kills: number;
  wave: number;
  enemies: number;
  mult: number;
  rapid: number;
  reloading: boolean;
  weapon: string;
  muted: boolean;
  locked: boolean;
}

export interface OverStats {
  score: number;
  kills: number;
  wave: number;
  accuracy: number;
  time: number;
}

export type GameEvent =
  | { type: "feed"; text: string; color: string }
  | { type: "banner"; title: string; sub: string }
  | { type: "over"; stats: OverStats }
  | { type: "pause" }
  | { type: "resume" };

interface Enemy {
  x: number; y: number; kind: EnemyKind;
  hp: number; maxHp: number; speed: number;
  animT: number; flash: number; shootT: number; cd: number;
  losT: number; los: boolean;
  strafeDir: number; strafeT: number;
  burst: number; burstT: number;
  scale: number; points: number;
}

interface Pickup { x: number; y: number; kind: "medkit" | "rapid"; t: number }
interface ScreenPart {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
  grav: number; add: boolean;
}
interface Tracer { x1: number; y1: number; x2: number; y2: number; t: number }
interface Dust { x: number; y: number; z: number; vx: number; vy: number }

/* ------------------------------------------------------------------ */
/* Map                                                                 */
/* ------------------------------------------------------------------ */

const MAP_ROWS = [
  "########################",
  "#..........MM..........#",
  "#.CC..##........##..CC.#",
  "#.CC..##........##..CC.#",
  "#.....M....HH....M.....#",
  "#......................#",
  "#..T................T..#",
  "#..T..C..........C..T..#",
  "#.....C...T..T...C.....#",
  "#.........T..T.........#",
  "#..HH.............HH...#",
  "#..HH.....P......HH....#",
  "#.........M..M.........#",
  "#.....C...M..M...C.....#",
  "#..HH.............HH...#",
  "#..HH....T....T...HH...#",
  "#..T..C..........C..T..#",
  "#..T................T..#",
  "#......................#",
  "#.....M....HH....M.....#",
  "#.CC..##........##..CC.#",
  "#.CC..##........##..CC.#",
  "#..........MM..........#",
  "########################",
];

const LEGEND: Record<string, number> = { "#": 1, M: 2, C: 3, H: 4, T: 5 };
const MW = 24;
const MH = 24;

const SPAWN_CELLS: Array<[number, number]> = [
  [1.5, 1.5], [22.5, 1.5], [1.5, 22.5], [22.5, 22.5],
  [9.5, 1.5], [14.5, 22.5], [1.5, 12.5], [22.5, 12.5],
  [6.5, 6.5], [17.5, 6.5], [6.5, 17.5], [17.5, 17.5],
  [12.5, 5.5], [5.5, 12.5], [18.5, 12.5], [12.5, 18.5],
];

const KILL_WORDS = ["HOSTILE DOWN", "TARGET NEUTRALIZED", "KILL CONFIRMED", "THREAT ELIMINATED", "TANGO DOWN"];
const WAVE_SUBS = ["HOSTILES INBOUND", "THEY'RE COMING", "HOLD THE LINE", "NO QUARTER", "STAY SHARP", "WEAPONS FREE"];

const ENEMY_BASE: Record<EnemyKind, { hp: number; speed: number; scale: number; points: number }> = {
  grunt: { hp: 60, speed: 1.55, scale: 1, points: 100 },
  runner: { hp: 38, speed: 2.85, scale: 0.94, points: 150 },
  heavy: { hp: 190, speed: 1.05, scale: 1.1, points: 300 },
};

function normAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mini: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private onHud: (h: HudData) => void;
  private onEvent: (e: GameEvent) => void;

  private W = 640;
  private H = 400;
  private zbuf = new Float32Array(640);
  private vignette: HTMLCanvasElement | null = null;
  private miniWalls: HTMLCanvasElement | null = null;

  private textures: HTMLCanvasElement[];
  private enemySprites: ReturnType<typeof makeEnemySprites>;
  private pickupSprites: ReturnType<typeof makePickupSprites>;
  private grid = new Uint8Array(MW * MH);
  private spawnX = 10.5;
  private spawnY = 11.5;

  private mode: "idle" | "play" = "idle";
  private paused = false;
  private dead = false;
  private deathT = 0;
  private overSent = false;
  locked = false;

  private p = {
    x: 10.5, y: 11.5, a: 0, hp: 100,
    mag: 30, reloading: false, reloadT: 0,
    chain: 0, chainT: 0, score: 0, kills: 0, shots: 0, hits: 0,
    rapidT: 0, bobT: 0, lastStep: 0,
  };
  private pitch = 0;
  private recoilPitch = 0;
  private shake = 0;
  private dmgFlash = 0;
  private muzzleT = 0;
  private recoil = 0;
  private hitMark = { t: 0, kill: false };
  private fireT = 0;

  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private parts: ScreenPart[] = [];
  private tracers: Tracer[] = [];
  private dust: Dust[] = [];

  private wave = 0;
  private waveActive = false;
  private waveDelay = 1.6;
  private startTime = 0;
  private now = 0;

  private keys = new Set<string>();
  private mouseDown = false;
  private mousePos = { x: -9999, y: -9999 };
  private prevMouse = { x: 0, y: 0 };
  private lastLockTry = 0;
  private onCtx = (e: Event) => e.preventDefault();

  private dirX = 1; private dirY = 0;
  private planeX = 0; private planeY = 0.66;

  private raf = 0;
  private last = 0;
  private hudT = 0;

  constructor(
    canvas: HTMLCanvasElement,
    mini: HTMLCanvasElement,
    onHud: (h: HudData) => void,
    onEvent: (e: GameEvent) => void
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.mini = mini;
    this.mctx = mini.getContext("2d")!;
    this.onHud = onHud;
    this.onEvent = onEvent;

    this.textures = makeWallTextures();
    this.enemySprites = makeEnemySprites();
    this.pickupSprites = makePickupSprites();

    for (let y = 0; y < MH; y++) {
      const row = (MAP_ROWS[y] ?? "").padEnd(MW, "#").slice(0, MW);
      for (let x = 0; x < MW; x++) {
        const ch = row[x];
        if (ch === "P") {
          this.spawnX = x + 0.5;
          this.spawnY = y + 0.5;
        }
        this.grid[y * MW + x] = LEGEND[ch] ?? 0;
      }
    }

    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("pointerlockchange", this.onPlc);
    window.addEventListener("blur", this.onBlur);
    this.canvas.addEventListener("contextmenu", this.onCtx);

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("pointerlockchange", this.onPlc);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
    sfx.stopAmbient();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  /* ---------------------------- public API ---------------------------- */

  startGame() {
    const p = this.p;
    p.x = this.spawnX; p.y = this.spawnY; p.a = -Math.PI / 2;
    p.hp = 100; p.mag = 30; p.reloading = false; p.reloadT = 0;
    p.chain = 0; p.chainT = 0; p.score = 0; p.kills = 0; p.shots = 0; p.hits = 0;
    p.rapidT = 0; p.bobT = 0;
    this.pitch = 0; this.recoilPitch = 0; this.shake = 0; this.dmgFlash = 0;
    this.muzzleT = 0; this.recoil = 0; this.fireT = 0;
    this.enemies = []; this.pickups = []; this.parts = []; this.tracers = [];
    this.wave = 0; this.waveActive = false; this.waveDelay = 2.0;
    this.dead = false; this.deathT = 0; this.overSent = false;
    this.paused = false; this.mode = "play";
    this.startTime = performance.now();
    this.mouseDown = false;
    this.dust = [];
    for (let i = 0; i < 46; i++) {
      this.dust.push({
        x: 1.2 + Math.random() * (MW - 2.4),
        y: 1.2 + Math.random() * (MH - 2.4),
        z: 0.15 + Math.random() * 0.7,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
      });
    }
    sfx.startAmbient();
    this.onEvent({ type: "banner", title: "OPERATION BLACKOUT", sub: "ELIMINATE ALL HOSTILES — HOLD THE ARENA" });
  }

  requestLock() {
    /* rate-limited: sandboxed environments may reject pointer lock */
    const now = performance.now();
    if (now - this.lastLockTry < 900) return;
    this.lastLockTry = now;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === "function") r.catch(() => undefined);
    } catch {
      /* pointer lock unavailable */
    }
  }

  resumeGame() {
    if (this.mode === "play" && this.paused && !this.dead) {
      this.paused = false;
      this.last = performance.now();
      this.onEvent({ type: "resume" });
    }
    this.requestLock(); /* best effort — game is fully playable without it */
  }

  quitToMenu() {
    this.mode = "idle";
    this.paused = false;
    this.dead = false;
    this.overSent = false;
    this.enemies = [];
    this.pickups = [];
    this.parts = [];
    this.tracers = [];
    sfx.stopAmbient();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  toggleMute(): boolean {
    const m = sfx.toggleMute();
    this.pushHud();
    return m;
  }

  clickCanvas() {
    if (this.mode === "play" && !this.locked && !this.dead && !this.paused) this.requestLock();
  }

  /* ---------------------------- input ---------------------------- */

  private resize = () => {
    const aspect = Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight));
    this.W = Math.min(920, Math.round(430 * aspect));
    this.H = Math.round(this.W / aspect);
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.zbuf = new Float32Array(this.W);
    const v = document.createElement("canvas");
    v.width = this.W; v.height = this.H;
    const g = v.getContext("2d")!;
    const rad = g.createRadialGradient(
      this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.32,
      this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.72
    );
    rad.addColorStop(0, "rgba(0,0,0,0)");
    rad.addColorStop(1, "rgba(0,0,0,0.58)");
    g.fillStyle = rad;
    g.fillRect(0, 0, this.W, this.H);
    this.vignette = v;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (e.code === "KeyR" && this.mode === "play" && !this.paused && !this.dead) this.startReload();
    if (e.code === "KeyP" && this.mode === "play" && !this.dead) {
      if (this.paused) this.resumeGame();
      else if (this.locked) document.exitPointerLock();
      else {
        this.paused = true;
        this.onEvent({ type: "pause" });
      }
    }
    if (e.code === "KeyM") this.toggleMute();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    this.mousePos.x = e.clientX;
    this.mousePos.y = e.clientY;
    if (this.mode === "play" && !this.paused && !this.dead) {
      if (this.locked) {
        this.p.a += e.movementX * 0.0024;
        this.pitch = clamp(this.pitch - e.movementY * 0.7, -this.H * 0.3, this.H * 0.3);
      }
      /* cursor steering (no pointer lock needed) runs in update() */
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      e.preventDefault();
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;
      this.mouseDown = true;
      if (this.mode === "play" && !this.locked && !this.paused && !this.dead) this.requestLock();
    }
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) this.mouseDown = false;
  };

  private onPlc = () => {
    this.locked = document.pointerLockElement === this.canvas;
    if (this.locked) {
      if (this.mode === "play" && this.paused && !this.dead) {
        this.paused = false;
        this.last = performance.now();
        this.onEvent({ type: "resume" });
      }
    } else if (this.mode === "play" && !this.paused && !this.dead && !this.overSent) {
      this.paused = true;
      this.onEvent({ type: "pause" });
    }
  };

  private onBlur = () => {
    if (this.mode === "play" && !this.paused && !this.dead && this.locked) {
      document.exitPointerLock();
    }
    this.keys.clear();
    this.mouseDown = false;
  };

  /* ---------------------------- helpers ---------------------------- */

  private solid(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return true;
    return this.grid[cy * MW + cx] > 0;
  }

  private collides(x: number, y: number, r: number): boolean {
    return (
      this.solid(Math.floor(x - r), Math.floor(y - r)) ||
      this.solid(Math.floor(x + r), Math.floor(y - r)) ||
      this.solid(Math.floor(x - r), Math.floor(y + r)) ||
      this.solid(Math.floor(x + r), Math.floor(y + r))
    );
  }

  private castGrid(ox: number, oy: number, dx: number, dy: number, maxDist: number): number {
    let mapX = Math.floor(ox), mapY = Math.floor(oy);
    const deltaX = Math.abs(dx) < 1e-9 ? 1e9 : Math.abs(1 / dx);
    const deltaY = Math.abs(dy) < 1e-9 ? 1e9 : Math.abs(1 / dy);
    let stepX: number, stepY: number, sideX: number, sideY: number;
    if (dx < 0) { stepX = -1; sideX = (ox - mapX) * deltaX; } else { stepX = 1; sideX = (mapX + 1 - ox) * deltaX; }
    if (dy < 0) { stepY = -1; sideY = (oy - mapY) * deltaY; } else { stepY = 1; sideY = (mapY + 1 - oy) * deltaY; }
    let side = 0;
    for (let i = 0; i < 64; i++) {
      if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
      else { sideY += deltaY; mapY += stepY; side = 1; }
      if (this.solid(mapX, mapY)) {
        const d = side === 0 ? sideX - deltaX : sideY - deltaY;
        return Math.min(d, maxDist);
      }
    }
    return maxDist;
  }

  private hasLOS(x: number, y: number, tx: number, ty: number): boolean {
    const dx = tx - x, dy = ty - y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return true;
    return this.castGrid(x, y, dx / dist, dy / dist, dist) >= dist - 0.08;
  }

  private project(x: number, y: number): { sx: number; ty: number } | null {
    const rx = x - this.p.x, ry = y - this.p.y;
    const invDet = 1 / (this.planeX * this.dirY - this.dirX * this.planeY);
    const tx = invDet * (this.dirY * rx - this.dirX * ry);
    const ty = invDet * (-this.planeY * rx + this.planeX * ry);
    if (ty <= 0.12) return null;
    return { sx: (this.W / 2) * (1 + tx / ty), ty };
  }

  private updateDir() {
    this.dirX = Math.cos(this.p.a);
    this.dirY = Math.sin(this.p.a);
    this.planeX = -Math.sin(this.p.a) * 0.66;
    this.planeY = Math.cos(this.p.a) * 0.66;
  }

  private mult(): number {
    return Math.min(5, Math.max(1, this.p.chain));
  }

  private pushHud() {
    this.onHud({
      hp: Math.max(0, Math.ceil(this.p.hp)),
      mag: this.p.mag,
      magSize: 30,
      score: this.p.score,
      kills: this.p.kills,
      wave: Math.max(1, this.wave),
      enemies: this.enemies.length,
      mult: this.mult(),
      rapid: Math.max(0, this.p.rapidT),
      reloading: this.p.reloading,
      weapon: "PHANTOM MK-IV",
      muted: sfx.muted,
      locked: this.locked,
    });
  }

  /* ---------------------------- combat ---------------------------- */

  private startReload() {
    const p = this.p;
    if (p.reloading || p.mag >= 30) return;
    p.reloading = true;
    p.reloadT = 0;
    sfx.reload();
  }

  private gunPose() {
    const p = this.p;
    const s = this.H / 430;
    const moving = this.moveFactor();
    const gx = this.W * 0.60 + Math.sin(p.bobT) * 6 * moving;
    const gy = this.H + 10 + Math.abs(Math.cos(p.bobT)) * 7 * moving
      + this.recoil * 15
      + (p.reloading ? Math.sin(Math.PI * clamp(p.reloadT / 1.5, 0, 1)) * 85 : 0);
    const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const rot = 0.42 + this.recoil * 0.1
      + (p.reloading ? Math.sin(Math.PI * clamp(p.reloadT / 1.5, 0, 1)) * 0.5 : 0)
      + (sprinting && moving > 0.4 ? 0.1 : 0);
    const tipX = gx + Math.cos(rot) * -200 * s;
    const tipY = gy + Math.sin(rot) * -200 * s;
    return { gx, gy, rot, s, tipX, tipY };
  }

  private moveFactor(): number {
    const k = this.keys;
    const f = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const r = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    return f !== 0 || r !== 0 ? 1 : 0;
  }

  private fire() {
    const p = this.p;
    p.mag--;
    p.shots++;
    this.recoil = 1;
    this.muzzleT = 0.055;
    this.shake = Math.min(10, this.shake + 2.1);
    this.recoilPitch -= 3.2;
    this.fireT = p.rapidT > 0 ? 0.068 : 0.115;
    sfx.shoot();

    const pose = this.gunPose();
    this.parts.push({
      x: pose.gx + Math.cos(pose.rot) * 40 * pose.s,
      y: pose.gy + Math.sin(pose.rot) * 40 * pose.s - 20 * pose.s,
      vx: 90 + Math.random() * 90, vy: -160 - Math.random() * 60,
      life: 0.75, maxLife: 0.75, size: 2.4, color: "#d8a437", grav: 620, add: false,
    });

    const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const spread = 0.011 + this.moveFactor() * 0.011 + (sprinting ? 0.018 : 0) + this.recoil * 0.006;
    const ang = p.a + (Math.random() - 0.5) * 2 * spread;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const wallDist = this.castGrid(p.x, p.y, dx, dy, 40);

    /* slightly generous hit detection when aiming without pointer lock */
    const hitR = this.locked ? 0.36 : 0.46;
    let best: Enemy | null = null;
    let bestT = Infinity;
    for (const e of this.enemies) {
      const ex = e.x - p.x, ey = e.y - p.y;
      const t = ex * dx + ey * dy;
      if (t > 0.3 && t < wallDist) {
        const perp = Math.abs(ex * dy - ey * dx);
        if (perp < hitR && t < bestT) { best = e; bestT = t; }
      }
    }

    if (best) {
      p.hits++;
      const dmg = 26 + Math.random() * 12;
      best.hp -= dmg;
      best.flash = 0.1;
      this.hitMark = { t: 0.16, kill: false };
      sfx.hit();
      const pr = this.project(best.x, best.y);
      if (pr) {
        const hgt = (this.H / pr.ty) * 0.86 * best.scale;
        const bottom = this.horizon() + (this.H / pr.ty) / 2;
        this.burst(pr.sx, bottom - hgt * (0.35 + Math.random() * 0.35), 8, ["#c22f24", "#8a1f1a", "#e05548"], 150, 320, false);
      }
      if (best.hp <= 0) this.killEnemy(best);
    } else {
      const rel = normAngle(ang - p.a);
      const col = clamp(Math.round(((Math.tan(rel) / 0.66 + 1) / 2) * this.W), 0, this.W - 1);
      this.burst(col, this.horizon() + (Math.random() - 0.5) * this.H * 0.2, 6, ["#ffd28a", "#ffb02e", "#fff2c8"], 90, 0, true);
    }
  }

  private burst(x: number, y: number, n: number, colors: string[], speed: number, grav: number, add: boolean) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      const life = 0.3 + Math.random() * 0.55;
      this.parts.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.25,
        life, maxLife: life,
        size: 1.5 + Math.random() * 2.6,
        color: colors[Math.floor(Math.random() * colors.length)],
        grav, add,
      });
    }
  }

  private killEnemy(e: Enemy) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    const p = this.p;
    p.chain++;
    p.chainT = 3;
    p.kills++;
    const gained = e.points * this.mult();
    p.score += gained;
    this.hitMark = { t: 0.2, kill: true };
    this.shake = Math.min(10, this.shake + 2.5);
    sfx.kill();
    this.onEvent({
      type: "feed",
      text: `${KILL_WORDS[Math.floor(Math.random() * KILL_WORDS.length)]}  +${gained}`,
      color: "#ffb02e",
    });
    const pr = this.project(e.x, e.y);
    if (pr) {
      const hgt = (this.H / pr.ty) * 0.86 * e.scale;
      const bottom = this.horizon() + (this.H / pr.ty) / 2;
      this.burst(pr.sx, bottom - hgt * 0.5, 26, ["#c22f24", "#8a1f1a", "#e05548", "#ffb02e"], 230, 340, false);
    }
    if (Math.random() < 0.3) {
      this.pickups.push({
        x: e.x, y: e.y,
        kind: Math.random() < 0.62 ? "medkit" : "rapid",
        t: 0,
      });
    }
  }

  private damagePlayer(dmg: number) {
    if (this.dead || this.mode !== "play") return;
    const p = this.p;
    p.hp -= dmg;
    this.dmgFlash = 1;
    this.shake = Math.min(14, this.shake + 5);
    sfx.hurt();
    if (p.hp <= 0) {
      p.hp = 0;
      this.dead = true;
      this.deathT = 1.5;
      this.mouseDown = false;
      sfx.over();
      sfx.stopAmbient();
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }
  }

  private enemyFire(e: Enemy, dmg: number, chance: number) {
    e.shootT = 0.13;
    sfx.eshoot();
    const pr = this.project(e.x, e.y);
    if (pr) {
      const hgt = (this.H / pr.ty) * 0.86 * e.scale;
      const bottom = this.horizon() + (this.H / pr.ty) / 2;
      this.tracers.push({
        x1: pr.sx - (this.H / pr.ty) * 0.86 * e.scale * 0.3,
        y1: bottom - hgt * 0.55,
        x2: this.W / 2 + (Math.random() - 0.5) * 110,
        y2: this.horizon() + (Math.random() - 0.5) * 70,
        t: 0.12,
      });
    }
    if (Math.random() < chance) this.damagePlayer(dmg);
  }

  /* ---------------------------- waves ---------------------------- */

  private startWave() {
    this.waveActive = true;
    const w = this.wave;
    const total = Math.min(4 + w * 2, 16);
    const heavies = w >= 3 ? Math.min(Math.floor(w / 2), Math.floor(total * 0.25)) : 0;
    const runners = w >= 2 ? Math.floor(total * 0.3) : 0;
    const grunts = total - heavies - runners;
    const kinds: EnemyKind[] = [
      ...Array<EnemyKind>(grunts).fill("grunt"),
      ...Array<EnemyKind>(runners).fill("runner"),
      ...Array<EnemyKind>(heavies).fill("heavy"),
    ];
    const cells = [...SPAWN_CELLS]
      .map((c) => ({ c, d: Math.hypot(c[0] - this.p.x, c[1] - this.p.y), r: Math.random() }))
      .sort((a, b) => (a.d < 6.5 ? 1 : 0) - (b.d < 6.5 ? 1 : 0) || b.r - a.r);
    kinds.forEach((kind, i) => {
      const cell = cells[i % cells.length].c;
      const base = ENEMY_BASE[kind];
      const hp = Math.round(base.hp * (1 + (w - 1) * 0.07));
      this.enemies.push({
        x: cell[0] + (Math.random() - 0.5) * 0.6,
        y: cell[1] + (Math.random() - 0.5) * 0.6,
        kind, hp, maxHp: hp,
        speed: Math.min(base.speed + (w - 1) * 0.05, base.speed * 1.6),
        animT: Math.random() * 10, flash: 0, shootT: 0,
        cd: 1 + Math.random() * 1.2,
        losT: Math.random() * 0.2, los: false,
        strafeDir: Math.random() > 0.5 ? 1 : -1, strafeT: 1 + Math.random() * 2,
        burst: 0, burstT: 0,
        scale: base.scale, points: base.points,
      });
    });
    sfx.wave();
    this.onEvent({
      type: "banner",
      title: `WAVE ${String(w).padStart(2, "0")}`,
      sub: WAVE_SUBS[Math.floor(Math.random() * WAVE_SUBS.length)],
    });
  }

  /* ---------------------------- update ---------------------------- */

  private tick = (t: number) => {
    this.raf = requestAnimationFrame(this.tick);
    let dt = clamp((t - this.last) / 1000, 0, 0.05);
    this.last = t;
    if (this.mode === "play" && !this.paused) {
      this.update(dt);
    }
    this.now += dt;
    this.render();
    this.renderMinimap();
    this.hudT -= dt;
    if (this.hudT <= 0 && this.mode === "play") {
      this.hudT = 0.12;
      this.pushHud();
    }
  };

  private horizon(): number {
    const drop = this.dead ? Math.pow(1 - this.deathT / 1.5, 2) * this.H * 0.45 : 0;
    return this.H / 2 + this.pitch + this.recoilPitch + drop;
  }

  private update(dt: number) {
    const p = this.p;
    this.shake *= Math.pow(0.0018, dt);
    if (this.shake < 0.05) this.shake = 0;
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 2.2);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.recoilPitch = Math.min(0, this.recoilPitch + dt * 26);
    this.hitMark.t = Math.max(0, this.hitMark.t - dt);
    if (p.chainT > 0) {
      p.chainT -= dt;
      if (p.chainT <= 0) p.chain = 0;
    }
    p.rapidT = Math.max(0, p.rapidT - dt);

    if (this.dead) {
      this.deathT -= dt;
      if (this.deathT <= 0 && !this.overSent) {
        this.overSent = true;
        this.onEvent({
          type: "over",
          stats: {
            score: p.score,
            kills: p.kills,
            wave: this.wave,
            accuracy: p.shots > 0 ? Math.round((p.hits / p.shots) * 100) : 0,
            time: (performance.now() - this.startTime) / 1000,
          },
        });
      }
      this.updateFx(dt);
      return;
    }

    this.updateDir();

    /* player movement */
    const k = this.keys;
    const f = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const r = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    const sprinting = (k.has("ShiftLeft") || k.has("ShiftRight")) && f > 0;
    const speed = sprinting ? 4.5 : 2.9;
    let mx = this.dirX * f - Math.sin(this.p.a) * -r;
    let my = this.dirY * f + Math.cos(this.p.a) * -r;
    /* strafe right vector is (-sin a, cos a) rotated? right = (cos(a+PI/2), sin(a+PI/2)) = (-sin, cos) */
    mx = this.dirX * f + -Math.sin(this.p.a) * r;
    my = this.dirY * f + Math.cos(this.p.a) * r;
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      mx = (mx / len) * speed * dt;
      my = (my / len) * speed * dt;
      const rad = 0.26;
      if (!this.collides(p.x + mx, p.y, rad)) p.x += mx;
      if (!this.collides(p.x, p.y + my, rad)) p.y += my;
      p.x = clamp(p.x, 1.3, MW - 1.3);
      p.y = clamp(p.y, 1.3, MH - 1.3);
      p.bobT += dt * speed * 1.75;
      const step = Math.floor(p.bobT / Math.PI);
      if (step !== p.lastStep) {
        p.lastStep = step;
        sfx.step();
      }
    }
    /* enemies push player */
    for (const e of this.enemies) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.62 && d > 0.001) {
        p.x += (dx / d) * (0.62 - d);
        p.y += (dy / d) * (0.62 - d);
      }
    }

    /* cursor steering (fallback when pointer lock is unavailable):
       the view turns toward wherever the cursor sits. Center = steady,
       further out = faster, pinned at the edge = continuous full turn —
       so you always look around with just the cursor. */
    if (!this.locked && this.mousePos.x >= 0) {
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const ox = (this.mousePos.x - vw / 2) / (vw / 2);
      const oy = (this.mousePos.y - vh / 2) / (vh / 2);
      const dead = 0.09;
      const steer = (v: number) => {
        const av = Math.min(1, Math.abs(v));
        if (av < dead) return 0;
        const s = (av - dead) / (1 - dead);
        return Math.sign(v) * s * s;
      };
      this.p.a += steer(ox) * dt * 3.5;
      const pLim = this.H * 0.3;
      this.pitch = clamp(this.pitch - steer(oy) * dt * 270, -pLim, pLim);
    }

    /* firing — works with or without pointer lock */
    this.fireT -= dt;
    if (this.mouseDown && !p.reloading) {
      if (p.mag > 0) {
        if (this.fireT <= 0) this.fire();
      } else if (this.fireT <= 0) {
        sfx.empty();
        this.startReload();
        this.fireT = 0.4;
      }
    }
    if (p.reloading) {
      p.reloadT += dt;
      if (p.reloadT >= 1.5) {
        p.reloading = false;
        p.mag = 30;
        sfx.reloadDone();
      }
    }

    /* enemies */
    for (const e of [...this.enemies]) {
      e.animT += dt * (0.55 + e.speed * 0.28);
      e.flash = Math.max(0, e.flash - dt);
      e.shootT = Math.max(0, e.shootT - dt);
      e.cd -= dt;
      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafeT = 1.2 + Math.random() * 2;
        e.strafeDir = Math.random() > 0.5 ? 1 : -1;
      }
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      e.losT -= dt;
      if (e.losT <= 0) {
        e.los = this.hasLOS(e.x, e.y, p.x, p.y);
        e.losT = 0.12 + Math.random() * 0.12;
      }
      let vx = 0, vy = 0;
      const nx = dist > 0.001 ? dx / dist : 0;
      const ny = dist > 0.001 ? dy / dist : 0;
      if (e.kind === "runner") {
        vx = nx * e.speed; vy = ny * e.speed;
        if (dist < 0.95 && e.cd <= 0 && e.los) {
          e.cd = 0.9;
          e.shootT = 0.12;
          this.damagePlayer(9 + this.wave);
        }
      } else {
        if (!e.los) { vx = nx * e.speed; vy = ny * e.speed; }
        else if (dist > (e.kind === "heavy" ? 6.5 : 9)) { vx = nx * e.speed; vy = ny * e.speed; }
        else if (dist < 3.2) { vx = -nx * e.speed * 0.6; vy = -ny * e.speed * 0.6; }
        else { vx = -ny * e.speed * 0.5 * e.strafeDir; vy = nx * e.speed * 0.5 * e.strafeDir; }

        if (e.kind === "grunt" && e.los && dist < 13 && e.cd <= 0) {
          e.cd = 1.6 + Math.random() * 0.6;
          this.enemyFire(e, 6 + Math.random() * 4, clamp(0.72 - dist * 0.028, 0.2, 0.72));
        }
        if (e.kind === "heavy") {
          if (e.burst > 0) {
            e.burstT -= dt;
            if (e.burstT <= 0 && e.los) {
              e.burst--;
              e.burstT = 0.16;
              this.enemyFire(e, 8, clamp(0.66 - dist * 0.02, 0.25, 0.66));
            }
          } else if (e.los && dist < 15 && e.cd <= 0) {
            e.cd = 2.6;
            e.burst = 3;
            e.burstT = 0;
          }
        }
      }
      /* separation */
      for (const o of this.enemies) {
        if (o === e) continue;
        const sx = e.x - o.x, sy = e.y - o.y;
        const sd = Math.hypot(sx, sy);
        if (sd < 0.6 && sd > 0.001) {
          vx += (sx / sd) * 1.4;
          vy += (sy / sd) * 1.4;
        }
      }
      const erad = 0.3;
      const ex2 = e.x + vx * dt, ey2 = e.y + vy * dt;
      if (!this.collides(ex2, e.y, erad)) e.x = ex2;
      else if (!this.collides(e.x + (vx > 0 ? 0.02 : -0.02), e.y, erad)) e.x += vx > 0 ? 0.02 : -0.02;
      if (!this.collides(e.x, ey2, erad)) e.y = ey2;
      e.x = clamp(e.x, 1.3, MW - 1.3);
      e.y = clamp(e.y, 1.3, MH - 1.3);
    }

    /* pickups */
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < 0.7) {
        this.pickups.splice(i, 1);
        sfx.pickup();
        if (pk.kind === "medkit") {
          p.hp = Math.min(100, p.hp + 30);
          this.onEvent({ type: "feed", text: "MEDKIT ACQUIRED  +30 HP", color: "#7dff8a" });
        } else {
          p.rapidT = 8;
          this.onEvent({ type: "feed", text: "RAPID FIRE  8s", color: "#ffb02e" });
        }
      }
    }

    /* waves */
    if (this.waveActive && this.enemies.length === 0) {
      this.waveActive = false;
      const bonus = 200 * this.wave;
      p.score += bonus;
      p.hp = Math.min(100, p.hp + 15);
      this.onEvent({ type: "feed", text: `WAVE ${this.wave} CLEARED  +${bonus}`, color: "#e8efe9" });
      this.waveDelay = 2.6;
    }
    if (!this.waveActive) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) {
        this.wave++;
        this.startWave();
      }
    }

    this.updateFx(dt);
  }

  private updateFx(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const pa = this.parts[i];
      pa.life -= dt;
      if (pa.life <= 0) { this.parts.splice(i, 1); continue; }
      pa.vy += pa.grav * dt;
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].t -= dt;
      if (this.tracers[i].t <= 0) this.tracers.splice(i, 1);
    }
    for (const du of this.dust) {
      du.x += du.vx * dt;
      du.y += du.vy * dt;
      if (du.x < 1.2 || du.x > MW - 1.2) du.vx *= -1;
      if (du.y < 1.2 || du.y > MH - 1.2) du.vy *= -1;
    }
  }

  /* ---------------------------- render ---------------------------- */

  private render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (this.mode === "idle") {
      ctx.fillStyle = "#04070a";
      ctx.fillRect(0, 0, W, H);
      return;
    }

    this.updateDir();
    const horizon = this.horizon();
    const shx = (Math.random() - 0.5) * this.shake;
    const shy = (Math.random() - 0.5) * this.shake;

    ctx.save();
    ctx.translate(shx, shy);

    /* ceiling */
    let g = ctx.createLinearGradient(0, -40, 0, Math.max(1, horizon));
    g.addColorStop(0, "#04060a");
    g.addColorStop(1, "#0b130e");
    ctx.fillStyle = g;
    ctx.fillRect(-20, -40, W + 40, Math.max(1, horizon) + 40);
    /* floor */
    g = ctx.createLinearGradient(0, horizon, 0, H + 40);
    g.addColorStop(0, "#0d130e");
    g.addColorStop(1, "#20291d");
    ctx.fillStyle = g;
    ctx.fillRect(-20, horizon, W + 40, H - horizon + 60);
    /* horizon haze */
    ctx.fillStyle = "rgba(255,176,46,0.05)";
    ctx.fillRect(-20, horizon - 1, W + 40, 2);
    g = ctx.createLinearGradient(0, horizon - 26, 0, horizon + 26);
    g.addColorStop(0, "rgba(10,16,12,0)");
    g.addColorStop(0.5, "rgba(10,16,12,0.5)");
    g.addColorStop(1, "rgba(10,16,12,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-20, horizon - 26, W + 40, 52);

    /* walls */
    const dirX = this.dirX, dirY = this.dirY;
    const planeX = this.planeX, planeY = this.planeY;
    const p = this.p;
    for (let x = 0; x < W; x++) {
      const cameraX = (2 * x) / W - 1;
      const rayX = dirX + planeX * cameraX;
      const rayY = dirY + planeY * cameraX;
      let mapX = Math.floor(p.x), mapY = Math.floor(p.y);
      const deltaX = Math.abs(rayX) < 1e-9 ? 1e9 : Math.abs(1 / rayX);
      const deltaY = Math.abs(rayY) < 1e-9 ? 1e9 : Math.abs(1 / rayY);
      let stepX: number, stepY: number, sideX: number, sideY: number;
      if (rayX < 0) { stepX = -1; sideX = (p.x - mapX) * deltaX; } else { stepX = 1; sideX = (mapX + 1 - p.x) * deltaX; }
      if (rayY < 0) { stepY = -1; sideY = (p.y - mapY) * deltaY; } else { stepY = 1; sideY = (mapY + 1 - p.y) * deltaY; }
      let side = 0, cell = 1;
      for (let i = 0; i < 48; i++) {
        if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
        else { sideY += deltaY; mapY += stepY; side = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= MW || mapY >= MH) { cell = 1; break; }
        cell = this.grid[mapY * MW + mapX];
        if (cell > 0) break;
      }
      const perp = Math.max(0.02, side === 0 ? sideX - deltaX : sideY - deltaY);
      this.zbuf[x] = perp;
      const lineH = H / perp;
      let wallX = side === 0 ? p.y + perp * rayY : p.x + perp * rayX;
      wallX -= Math.floor(wallX);
      let texX = Math.floor(wallX * 64);
      if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) texX = 63 - texX;
      const top = horizon - lineH / 2;
      ctx.drawImage(this.textures[cell] ?? this.textures[0], texX, 0, 1, 64, x, top, 1, lineH);
      const fog = Math.min(0.94, perp / 16 + (side === 1 ? 0.13 : 0));
      if (fog > 0.03) {
        ctx.fillStyle = `rgba(4,7,6,${fog.toFixed(3)})`;
        ctx.fillRect(x, top, 1, lineH);
      }
    }

    /* dust motes */
    ctx.globalCompositeOperation = "lighter";
    for (const du of this.dust) {
      const pr = this.project(du.x, du.y);
      if (!pr || pr.ty > 15) continue;
      const sz = clamp((H / pr.ty) * 0.012 * du.z, 0.6, 3.5);
      const a = 0.05 + 0.09 * (1 - pr.ty / 15);
      ctx.fillStyle = `rgba(190,225,190,${a.toFixed(3)})`;
      const dy = horizon + (H / pr.ty) / 2 - (H / pr.ty) * du.z;
      ctx.fillRect(pr.sx, dy, sz, sz);
    }
    ctx.globalCompositeOperation = "source-over";

    /* sprites */
    type Item =
      | { ty: number; kind: "enemy"; e: Enemy }
      | { ty: number; kind: "pick"; pk: Pickup };
    const items: Item[] = [];
    for (const e of this.enemies) {
      const pr = this.project(e.x, e.y);
      if (pr) items.push({ ty: pr.ty, kind: "enemy", e });
    }
    for (const pk of this.pickups) {
      const pr = this.project(pk.x, pk.y);
      if (pr) items.push({ ty: pr.ty, kind: "pick", pk });
    }
    items.sort((a, b) => b.ty - a.ty);

    for (const it of items) {
      if (it.kind === "enemy") {
        const e = it.e;
        const ty = it.ty;
        const pr = this.project(e.x, e.y);
        if (!pr) continue;
        const sprites = this.enemySprites[e.kind];
        const img = e.flash > 0 ? sprites.hit : sprites.walk[Math.floor(e.animT * 5) % 2];
        const hgt = (H / ty) * 0.86 * e.scale;
        const wdt = hgt * (SW / SH);
        const bottom = horizon + (H / ty) / 2;
        const startX = pr.sx - wdt / 2;
        const c0 = Math.max(0, Math.floor(startX));
        const c1 = Math.min(W - 1, Math.ceil(startX + wdt));
        const sww = Math.max(SW / wdt, 0.9);
        for (let col = c0; col <= c1; col++) {
          if (this.zbuf[col] > ty + 0.05) {
            const srcX = clamp(((col - startX) / wdt) * SW, 0, SW - 1);
            ctx.drawImage(img, srcX, 0, sww, SH, col, bottom - hgt, 1, hgt);
          }
        }
        /* distance fog on sprite */
        const fog = Math.min(0.85, ty / 17);
        if (fog > 0.05) {
          ctx.fillStyle = `rgba(4,7,6,${(fog * 0.75).toFixed(3)})`;
          for (let col = c0; col <= c1; col++) {
            if (this.zbuf[col] > ty + 0.05) ctx.fillRect(col, bottom - hgt, 1, hgt);
          }
        }
        /* hp bar */
        if (e.hp < e.maxHp && ty < 16) {
          const bw = clamp(wdt * 0.62, 14, 46);
          const pct = clamp(e.hp / e.maxHp, 0, 1);
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(pr.sx - bw / 2, bottom - hgt - 9, bw, 3.5);
          ctx.fillStyle = pct > 0.5 ? "#9acd32" : "#ff5b4d";
          ctx.fillRect(pr.sx - bw / 2, bottom - hgt - 9, bw * pct, 3.5);
        }
        /* enemy muzzle flash */
        if (e.shootT > 0) {
          ctx.globalCompositeOperation = "lighter";
          const mx = pr.sx - wdt * 0.42;
          const my = bottom - hgt * 0.52;
          const rad = wdt * 0.13 + 3;
          const fg = ctx.createRadialGradient(mx, my, 0, mx, my, rad);
          fg.addColorStop(0, "rgba(255,240,180,0.95)");
          fg.addColorStop(0.4, "rgba(255,176,46,0.55)");
          fg.addColorStop(1, "rgba(255,176,46,0)");
          ctx.fillStyle = fg;
          ctx.fillRect(mx - rad, my - rad, rad * 2, rad * 2);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        const pk = it.pk;
        const ty = it.ty;
        const pr = this.project(pk.x, pk.y);
        if (!pr) continue;
        const img = this.pickupSprites[pk.kind];
        const size = (H / ty) * 0.3;
        const bottom = horizon + (H / ty) / 2 - Math.abs(Math.sin(pk.t * 3)) * size * 0.28 - size * 0.06;
        const startX = pr.sx - size / 2;
        const c0 = Math.max(0, Math.floor(startX));
        const c1 = Math.min(W - 1, Math.ceil(startX + size));
        const sww = Math.max(36 / size, 0.9);
        /* glow pad */
        ctx.globalCompositeOperation = "lighter";
        const glowC = pk.kind === "medkit" ? "rgba(125,255,138,0.14)" : "rgba(255,176,46,0.14)";
        const gy2 = horizon + (H / ty) / 2;
        const gr2 = size * 0.8;
        const gg = ctx.createRadialGradient(pr.sx, gy2, 0, pr.sx, gy2, gr2);
        gg.addColorStop(0, glowC);
        gg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gg;
        ctx.fillRect(pr.sx - gr2, gy2 - gr2 * 0.4, gr2 * 2, gr2 * 0.8);
        ctx.globalCompositeOperation = "source-over";
        for (let col = c0; col <= c1; col++) {
          if (this.zbuf[col] > ty + 0.05) {
            const srcX = clamp(((col - startX) / size) * 36, 0, 35);
            ctx.drawImage(img, srcX, 0, sww, 36, col, bottom - size, 1, size);
          }
        }
      }
    }

    /* particles */
    for (const pa of this.parts) {
      const a = clamp(pa.life / pa.maxLife, 0, 1);
      ctx.globalAlpha = a;
      if (pa.add) ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = pa.color;
      ctx.fillRect(pa.x - pa.size / 2, pa.y - pa.size / 2, pa.size, pa.size);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;

    /* tracers */
    ctx.globalCompositeOperation = "lighter";
    for (const tr of this.tracers) {
      const a = clamp(tr.t / 0.12, 0, 1);
      ctx.strokeStyle = `rgba(255,190,110,${(a * 0.75).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tr.x1, tr.y1);
      ctx.lineTo(tr.x2, tr.y2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";

    /* gun */
    this.drawGun(ctx);

    ctx.restore();

    /* muzzle screen light */
    if (this.muzzleT > 0) {
      ctx.fillStyle = `rgba(255,190,80,${(this.muzzleT * 1.1).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    /* vignette */
    if (this.vignette) ctx.drawImage(this.vignette, 0, 0);

    /* damage / low hp overlay */
    const lowPulse = p.hp < 30 && !this.dead ? 0.16 + 0.12 * Math.sin(this.now * 6.5) : 0;
    const dmgA = clamp(this.dmgFlash * 0.5 + lowPulse, 0, 0.75);
    if (dmgA > 0.01) {
      const dg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.62);
      dg.addColorStop(0, "rgba(255,32,22,0)");
      dg.addColorStop(1, `rgba(255,32,22,${dmgA.toFixed(3)})`);
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, W, H);
    }

    /* death fade */
    if (this.dead) {
      const f = clamp(1 - this.deathT / 1.5, 0, 1);
      ctx.fillStyle = `rgba(60,4,2,${(f * 0.72).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    /* crosshair + hit marker */
    if (!this.dead) this.drawCrosshair(ctx, W, H);
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const cx = W / 2, cy = H / 2;
    const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const gap = 8 + this.moveFactor() * 5 + this.recoil * 11 + (sprinting ? 5 : 0);
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3.4;
    this.crossLines(ctx, cx, cy, gap, 10);
    ctx.stroke();
    ctx.strokeStyle = "rgba(240,255,240,0.95)";
    ctx.lineWidth = 1.6;
    this.crossLines(ctx, cx, cy, gap, 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,176,46,0.95)";
    ctx.fillRect(cx - 1.2, cy - 1.2, 2.4, 2.4);

    if (this.hitMark.t > 0) {
      const a = clamp(this.hitMark.t / (this.hitMark.kill ? 0.2 : 0.16), 0, 1);
      ctx.strokeStyle = this.hitMark.kill ? `rgba(255,59,48,${a.toFixed(3)})` : `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        ctx.moveTo(cx + dx * 5, cy + dy * 5);
        ctx.lineTo(cx + dx * 12, cy + dy * 12);
      }
      ctx.stroke();
    }

    if (this.p.chain >= 2) {
      const a = clamp(this.p.chainT / 3, 0, 1);
      ctx.font = `700 ${Math.round(H * 0.045)}px Rajdhani, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,176,46,${(0.35 + 0.65 * a).toFixed(3)})`;
      ctx.fillText(`×${this.mult()}`, cx, cy + H * 0.075);
    }
  }

  private crossLines(ctx: CanvasRenderingContext2D, cx: number, cy: number, gap: number, len: number) {
    ctx.beginPath();
    ctx.moveTo(cx - gap - len, cy); ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + gap + len, cy);
    ctx.moveTo(cx, cy - gap - len); ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + gap + len);
  }

  private drawGun(ctx: CanvasRenderingContext2D) {
    const pose = this.gunPose();
    const s = pose.s;
    ctx.save();
    ctx.translate(pose.gx, pose.gy);
    ctx.rotate(pose.rot);
    ctx.scale(s, s);

    const rt = this.p.reloading ? Math.sin(Math.PI * clamp(this.p.reloadT / 1.5, 0, 1)) : 0;

    /* stock */
    ctx.fillStyle = "#171b20";
    ctx.fillRect(84, -10, 46, 22);
    ctx.fillStyle = "#0d0f12";
    ctx.fillRect(124, -12, 8, 26);
    /* receiver */
    ctx.fillStyle = "#1c2026";
    ctx.fillRect(8, -14, 78, 28);
    ctx.fillStyle = "#0e1013";
    ctx.fillRect(30, -8, 22, 8);
    ctx.fillStyle = "rgba(255,176,46,0.85)";
    ctx.fillRect(12, -3, 42, 3);
    /* carry handle sight */
    ctx.fillStyle = "#23272e";
    ctx.fillRect(18, -26, 36, 12);
    ctx.fillStyle = "#0b0d0f";
    ctx.fillRect(30, -23, 10, 6);
    /* handguard */
    ctx.fillStyle = "#2b3038";
    ctx.fillRect(-72, -11, 82, 22);
    ctx.fillStyle = "#171a20";
    ctx.fillRect(-62, -6, 14, 4);
    ctx.fillRect(-40, -6, 14, 4);
    ctx.fillRect(-18, -6, 14, 4);
    /* barrel */
    ctx.fillStyle = "#23272e";
    ctx.fillRect(-190, -7, 120, 13);
    ctx.fillStyle = "#14171c";
    ctx.fillRect(-202, -10, 16, 18);
    ctx.fillStyle = "#2b3038";
    ctx.fillRect(-180, -21, 5, 14);
    /* magazine (drops on reload) */
    ctx.save();
    ctx.translate(38, 12);
    ctx.rotate(0.22 + rt * 0.5);
    ctx.fillStyle = "#262b31";
    ctx.fillRect(-9, 0 + rt * 46, 20, 34);
    ctx.fillStyle = "#14171c";
    ctx.fillRect(-9, 26 + rt * 46, 20, 6);
    ctx.restore();
    /* grip */
    ctx.save();
    ctx.translate(78, 10);
    ctx.rotate(-0.28);
    ctx.fillStyle = "#1a1e23";
    ctx.fillRect(-7, 0, 15, 30);
    ctx.restore();
    /* hands */
    ctx.fillStyle = "#20262b";
    ctx.beginPath();
    ctx.arc(-44, 9, 12, 0, Math.PI * 2);
    ctx.arc(60, 20, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(-72, -11, 158, 3);

    /* muzzle flash */
    if (this.muzzleT > 0) {
      ctx.globalCompositeOperation = "lighter";
      const mx = -206, my = -1;
      const r1 = 26 + Math.random() * 10;
      const fg = ctx.createRadialGradient(mx, my, 0, mx, my, r1);
      fg.addColorStop(0, "rgba(255,247,214,0.98)");
      fg.addColorStop(0.35, "rgba(255,176,46,0.8)");
      fg.addColorStop(1, "rgba(255,120,20,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(mx - r1, my - r1, r1 * 2, r1 * 2);
      ctx.fillStyle = "rgba(255,230,160,0.9)";
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.random() * 0.3;
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a) * r1 * 1.4, my + Math.sin(a) * r1 * 1.4);
        ctx.lineTo(mx + Math.cos(a + 0.35) * r1 * 0.5, my + Math.sin(a + 0.35) * r1 * 0.5);
      }
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  }

  /* ---------------------------- minimap ---------------------------- */

  private renderMinimap() {
    if (this.mode !== "play") return;
    const m = this.mctx;
    const S = 6;
    if (!this.miniWalls) {
      const c = document.createElement("canvas");
      c.width = MW * S;
      c.height = MH * S;
      const g = c.getContext("2d")!;
      g.fillStyle = "rgba(10,16,12,0.9)";
      g.fillRect(0, 0, c.width, c.height);
      for (let y = 0; y < MH; y++) {
        for (let x = 0; x < MW; x++) {
          const cell = this.grid[y * MW + x];
          if (cell > 0) {
            g.fillStyle = cell === 4 ? "#8a6a24" : cell === 5 ? "#2c6b46" : "#3d4a40";
            g.fillRect(x * S, y * S, S, S);
            g.fillStyle = "rgba(255,255,255,0.12)";
            g.fillRect(x * S, y * S, S, 1);
          }
        }
      }
      this.miniWalls = c;
    }
    const w = this.mini.width, h = this.mini.height;
    m.clearRect(0, 0, w, h);
    const ox = (w - MW * S) / 2, oy = (h - MH * S) / 2;
    m.drawImage(this.miniWalls, ox, oy);
    const px = ox + this.p.x * S, py = oy + this.p.y * S;
    /* FOV wedge */
    m.fillStyle = "rgba(255,176,46,0.08)";
    m.beginPath();
    m.moveTo(px, py);
    m.arc(px, py, 30, this.p.a - 0.55, this.p.a + 0.55);
    m.closePath();
    m.fill();
    /* pickups */
    for (const pk of this.pickups) {
      m.fillStyle = pk.kind === "medkit" ? "#7dff8a" : "#ffb02e";
      m.fillRect(ox + pk.x * S - 1.5, oy + pk.y * S - 1.5, 3, 3);
    }
    /* enemies */
    for (const e of this.enemies) {
      m.fillStyle = e.kind === "heavy" ? "#ff9f1c" : e.kind === "runner" ? "#ff3b30" : "#ff6b4d";
      m.beginPath();
      m.arc(ox + e.x * S, oy + e.y * S, e.kind === "heavy" ? 3 : 2.2, 0, Math.PI * 2);
      m.fill();
    }
    /* player */
    m.fillStyle = "#ffb02e";
    m.save();
    m.translate(px, py);
    m.rotate(this.p.a);
    m.beginPath();
    m.moveTo(5, 0);
    m.lineTo(-3.5, -3.2);
    m.lineTo(-3.5, 3.2);
    m.closePath();
    m.fill();
    m.restore();
  }
}
