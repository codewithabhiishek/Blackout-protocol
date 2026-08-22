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
  crouched: boolean;
  weapon: string;
  weaponIdx: number;
  fireMode: string;
  muted: boolean;
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
  rot?: number; vrot?: number; rect?: boolean;
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

/* ---------------------------- weapons ---------------------------- */

export interface WeaponDef {
  name: string; short: string; fireMode: string;
  mag: number; interval: number; auto: boolean;
  dmgLo: number; dmgHi: number; pellets: number;
  spread: number; recoil: number; shake: number; kick: number;
  reload: number; range: number; flash: number;
  sound: "rifle" | "smg" | "shotgun";
}

export const WEAPONS: WeaponDef[] = [
  {
    /* precise semi-auto marksman rifle — one deliberate shot per trigger pull */
    name: "PHANTOM MK-IV", short: "RIFLE", fireMode: "SEMI-AUTO",
    mag: 24, interval: 0.17, auto: false,
    dmgLo: 34, dmgHi: 48, pellets: 1,
    spread: 0.005, recoil: 1.25, shake: 2.4, kick: 4.2,
    reload: 1.6, range: 40, flash: 1, sound: "rifle",
  },
  {
    /* full-auto PDW — hold the trigger and spray */
    name: "SCORPION PDW", short: "SMG", fireMode: "FULL-AUTO",
    mag: 40, interval: 0.06, auto: true,
    dmgLo: 12, dmgHi: 19, pellets: 1,
    spread: 0.022, recoil: 0.5, shake: 1.2, kick: 1.5,
    reload: 1.2, range: 30, flash: 0.7, sound: "smg",
  },
  {
    /* 8-pellet pump blast — shreds at close range */
    name: "JUDGE-12", short: "SHOTGUN", fireMode: "PUMP-ACTION",
    mag: 6, interval: 0.85, auto: false,
    dmgLo: 11, dmgHi: 17, pellets: 8,
    spread: 0.085, recoil: 1.7, shake: 6, kick: 8,
    reload: 2.1, range: 10, flash: 1.7, sound: "shotgun",
  },
];

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
    reloading: false, reloadT: 0,
    chain: 0, chainT: 0, score: 0, kills: 0, shots: 0, hits: 0,
    rapidT: 0, bobT: 0, lastStep: 0,
    pz: 0, vz: 0, grounded: true,
  };
  private wIdx = 0;
  private mags = [24, 40, 6];
  private swapT = 1;
  private triggerReady = true;
  private lockDisabled = false;
  /* aim feel */
  private lookDX = 0;
  private lookDY = 0;
  private swayX = 0;
  private swayY = 0;
  private landDip = 0;
  /* juice */
  private corpses: Array<{ x: number; y: number; kind: EnemyKind; t: number; scale: number }> = [];
  private dmgDirs: Array<{ ang: number; t: number }> = [];
  /* decals: persistent blood pools on the floor (world space) */
  private decals: Array<{ x: number; y: number; r: number; seed: number; rot: number }> = [];
  /* floating combat text in world space */
  private floaters: Array<{ x: number; y: number; z: number; vz: number; t: number; max: number; txt: string; color: string; size: number }> = [];
  /* soft volumetric smoke puffs (screen space) */
  private smoke: Array<{ x: number; y: number; vx: number; vy: number; t: number; max: number; r: number; grow: number; alpha: number; rgb: string }> = [];
  private pitch = 0;
  private recoilPitch = 0;
  private shake = 0;
  private dmgFlash = 0;
  private muzzleT = 0;
  private recoil = 0;
  private hitMark = { t: 0, kill: false };
  private lastHead = false;
  private fireT = 0;
  private crouchT = 0;
  private crouchLock = false;
  private meleeT = 0;
  private meleeCd = 0;
  private fovKick = 0;

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
  private lastMoveT = -9999;
  private moveVX = 0;
  private moveVY = 0;
  private lastLockTry = 0;
  private lockHeldSince = 0;
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
    document.addEventListener("wheel", this.onWheel, { passive: false });

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
    document.removeEventListener("wheel", this.onWheel);
    sfx.stopAmbient();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  /* ---------------------------- public API ---------------------------- */

  startGame() {
    const p = this.p;
    p.x = this.spawnX; p.y = this.spawnY; p.a = -Math.PI / 2;
    p.hp = 100; p.reloading = false; p.reloadT = 0;
    this.wIdx = 0; this.mags = [WEAPONS[0].mag, WEAPONS[1].mag, WEAPONS[2].mag];
    this.swapT = 1; this.triggerReady = true;
    p.chain = 0; p.chainT = 0; p.score = 0; p.kills = 0; p.shots = 0; p.hits = 0;
    p.rapidT = 0; p.bobT = 0;
    p.pz = 0; p.vz = 0; p.grounded = true;
    this.pitch = 0; this.recoilPitch = 0; this.shake = 0; this.dmgFlash = 0;
    this.muzzleT = 0; this.recoil = 0; this.fireT = 0;
    this.crouchT = 0; this.crouchLock = false;
    this.meleeT = 0; this.meleeCd = 0; this.fovKick = 0;
    this.enemies = []; this.pickups = []; this.parts = []; this.tracers = [];
    this.corpses = []; this.dmgDirs = [];
    this.decals = []; this.floaters = []; this.smoke = [];
    this.swayX = 0; this.swayY = 0; this.lookDX = 0; this.lookDY = 0; this.landDip = 0;
    this.wIdx = 0; this.mags = [24, 40, 6]; this.swapT = 1; this.triggerReady = true;
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
    if (this.lockDisabled) return;
    const now = performance.now();
    if (now - this.lastLockTry < 1200) return;
    this.lastLockTry = now;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === "function") r.catch(() => undefined);
    } catch {
      /* pointer lock unavailable — relative mouse-look fallback takes over */
    }
  }

  resumeGame() {
    if (this.mode !== "play" || !this.paused || this.dead) return;
    this.paused = false;
    this.last = performance.now();
    this.onEvent({ type: "resume" });
    this.requestLock();
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
    if (this.mode === "play" && !this.paused && !this.dead) {
      if (e.code === "KeyR") this.startReload();
      if (e.code === "Space") this.tryJump();
      if (e.code === "KeyC") this.crouchLock = !this.crouchLock;
      if (e.code === "KeyF" || e.code === "KeyV") this.tryMelee();
      if (e.code === "Digit1") this.switchWeapon(0);
      if (e.code === "Digit2") this.switchWeapon(1);
      if (e.code === "Digit3") this.switchWeapon(2);
      if (e.code === "KeyQ") this.switchWeapon((this.wIdx + 1) % WEAPONS.length);
    }
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
    const inWin =
      e.clientX >= 0 && e.clientX <= window.innerWidth &&
      e.clientY >= 0 && e.clientY <= window.innerHeight;
    this.mousePos.x = e.clientX;
    this.mousePos.y = e.clientY;
    if (this.mode === "play" && !this.paused && !this.dead) {
      const pLim = this.H * 0.3;
      if (this.locked) {
        /* true pointer-lock mouse look */
        this.p.a += e.movementX * 0.0026;
        this.pitch = clamp(this.pitch - e.movementY * 0.75, -pLim, pLim);
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      } else if (inWin) {
        /* relative mouse look without pointer lock:
           moving the mouse itself turns the view — same feel, no cursor */
        const rawDX = e.clientX - this.prevMouse.x;
        const rawDY = e.clientY - this.prevMouse.y;
        /* ignore teleports (trackpad finger lift/reposition, OS cursor
           jumps) so the camera can never be yanked around */
        if (Math.abs(rawDX) < 150 && Math.abs(rawDY) < 150) {
          const dx = clamp(rawDX, -26, 26);
          const dy = clamp(rawDY, -26, 26);
          this.p.a += dx * 0.0026;
          this.pitch = clamp(this.pitch - dy * 0.75, -pLim, pLim);
          this.lookDX += dx;
          this.lookDY += dy;
          this.lastMoveT = this.now;
          this.moveVX = rawDX;
          this.moveVY = rawDY;
        }
      }
    }
    this.prevMouse.x = e.clientX;
    this.prevMouse.y = e.clientY;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      e.preventDefault();
      window.focus?.();
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;
      this.mouseDown = true;
      this.triggerReady = true;
      if (this.mode === "play" && !this.locked && !this.paused && !this.dead) this.requestLock();
    }
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) this.mouseDown = false;
  };

  private onPlc = () => {
    const nowLocked = document.pointerLockElement === this.canvas;
    const wasLocked = this.locked;
    this.locked = nowLocked;
    if (nowLocked) {
      this.lockHeldSince = performance.now();
      if (this.mode === "play" && this.paused && !this.dead) {
        this.paused = false;
        this.last = performance.now();
        this.onEvent({ type: "resume" });
      }
    } else if (wasLocked && this.mode === "play" && !this.paused && !this.dead && !this.overSent) {
      const held = performance.now() - this.lockHeldSince;
      if (held > 900) {
        /* stable capture was released deliberately (Esc) → pause */
        this.paused = true;
        this.onEvent({ type: "pause" });
      } else if (!this.lockDisabled) {
        /* pointer lock flickered (environment can't hold it). Permanently
           give up on it: never request it again, so the cursor can never
           be hijacked back to the middle. Relative mouse-look takes over. */
        this.lockDisabled = true;
        this.onEvent({
          type: "feed",
          text: "CURSOR LOCK DISABLED — STEADY AIM ENGAGED",
          color: "#9acd32",
        });
      }
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
    const mag = 0.66 + this.fovKick * 0.13 - this.crouchT * 0.03;
    this.dirX = Math.cos(this.p.a);
    this.dirY = Math.sin(this.p.a);
    this.planeX = -Math.sin(this.p.a) * mag;
    this.planeY = Math.cos(this.p.a) * mag;
  }

  private eyeH(): number {
    return 0.5 + this.p.pz - 0.22 * this.crouchT;
  }

  private mult(): number {
    return Math.min(5, Math.max(1, this.p.chain));
  }

  private pushHud() {
    const def = WEAPONS[this.wIdx];
    this.onHud({
      hp: Math.max(0, Math.ceil(this.p.hp)),
      mag: this.mags[this.wIdx],
      magSize: def.mag,
      score: this.p.score,
      kills: this.p.kills,
      wave: Math.max(1, this.wave),
      enemies: this.enemies.length,
      mult: this.mult(),
      rapid: Math.max(0, this.p.rapidT),
      reloading: this.p.reloading,
      crouched: this.crouchT > 0.5,
      weapon: def.name,
      weaponIdx: this.wIdx,
      fireMode: def.fireMode,
      muted: sfx.muted,
    });
  }

  /* ---------------------------- combat ---------------------------- */

  private startReload() {
    const p = this.p;
    const def = WEAPONS[this.wIdx];
    if (p.reloading || this.mags[this.wIdx] >= def.mag) return;
    p.reloading = true;
    p.reloadT = 0;
    sfx.reload();
  }

  private switchWeapon(i: number) {
    if (i === this.wIdx || i < 0 || i >= WEAPONS.length) return;
    if (this.mode !== "play" || this.paused || this.dead) return;
    this.wIdx = i;
    this.p.reloading = false;
    this.p.reloadT = 0;
    this.swapT = 0;
    this.fireT = Math.max(this.fireT, 0.3);
    this.triggerReady = true;
    sfx.swap();
  }

  private onWheel = (e: WheelEvent) => {
    if (this.mode !== "play" || this.paused || this.dead) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    this.switchWeapon((this.wIdx + dir + WEAPONS.length) % WEAPONS.length);
  };

  private tryJump() {
    if (this.p.grounded) {
      this.p.vz = 2.5;
      this.p.grounded = false;
      sfx.jump();
    }
  }

  private tryMelee() {
    if (this.meleeCd > 0) return;
    this.meleeT = 0.26;
    this.meleeCd = 0.45;
    sfx.melee();
    const p = this.p;
    let best: Enemy | null = null;
    let bestD = 1.7;
    for (const e of this.enemies) {
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        const ang = Math.abs(normAngle(Math.atan2(dy, dx) - p.a));
        if (ang < 0.85) { best = e; bestD = d; }
      }
    }
    if (best) {
      best.hp -= 75;
      best.flash = 0.12;
      const dx = best.x - p.x, dy = best.y - p.y;
      const d = Math.max(0.001, Math.hypot(dx, dy));
      const kx = (dx / d) * 0.55, ky = (dy / d) * 0.55;
      if (!this.collides(best.x + kx, best.y, 0.3)) best.x += kx;
      if (!this.collides(best.x, best.y + ky, 0.3)) best.y += ky;
      this.hitMark = { t: 0.18, kill: false };
      this.shake = Math.min(10, this.shake + 2);
      sfx.meleeHit();
      const pr = this.project(best.x, best.y);
      if (pr) {
        const ey = this.eyeH();
        const bottom = this.horizon() + ey * (this.H / pr.ty);
        const hgt = (this.H / pr.ty) * 0.86 * best.scale;
        this.burst(pr.sx, bottom - hgt * 0.5, 12, ["#c22f24", "#8a1f1a", "#e05548"], 190, 330, false);
      }
      if (best.hp <= 0) this.killEnemy(best);
    }
  }

  private gunPose() {
    const p = this.p;
    const s = this.H / 430;
    const moving = this.moveFactor();
    const def = WEAPONS[this.wIdx];
    const rt = p.reloading ? Math.sin(Math.PI * clamp(p.reloadT / def.reload, 0, 1)) : 0;
    const swap = Math.sin((1 - this.swapT) * Math.PI * 0.5) * 70;
    /* idle breathing sway when standing still */
    const idle = moving > 0.4 ? 0 : 1;
    const breathX = Math.sin(this.now * 1.6) * 1.6 * idle;
    const breathY = Math.sin(this.now * 2.3) * 1.2 * idle;
    const gx = this.W * 0.60 + Math.sin(p.bobT) * 6 * moving + clamp(this.swayX, -26, 26) + breathX;
    const gy = this.H + 10 + Math.abs(Math.cos(p.bobT)) * 7 * moving
      + this.recoil * 15
      + this.crouchT * 24 * s
      + p.pz * 55 * s
      + rt * 85
      + swap
      + clamp(this.swayY, -18, 18) + breathY;
    const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const rot = 0.42 + this.recoil * 0.1 + this.crouchT * 0.05
      + rt * 0.5
      + clamp(this.swayX, -26, 26) * 0.004
      + (sprinting && moving > 0.4 ? 0.1 : 0);
    return { gx, gy, rot, s };
  }

  private moveFactor(): number {
    const k = this.keys;
    const f = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const r = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    return f !== 0 || r !== 0 ? 1 : 0;
  }

  private fire() {
    const p = this.p;
    const def = WEAPONS[this.wIdx];
    this.mags[this.wIdx]--;
    p.shots++;
    this.recoil = def.recoil;
    this.muzzleT = 0.055;
    this.shake = Math.min(14, this.shake + def.shake);
    this.recoilPitch -= def.kick;
    this.fireT = def.interval * (p.rapidT > 0 ? 0.62 : 1);
    if (def.sound === "smg") sfx.shootSmg();
    else if (def.sound === "shotgun") sfx.shootShotgun();
    else sfx.shoot();

    const pose = this.gunPose();
    this.parts.push({
      x: pose.gx + Math.cos(pose.rot) * 40 * pose.s,
      y: pose.gy + Math.sin(pose.rot) * 40 * pose.s - 20 * pose.s,
      vx: 90 + Math.random() * 90, vy: -160 - Math.random() * 60,
      life: 0.75, maxLife: 0.75,
      size: def.sound === "shotgun" ? 3.4 : 2.5,
      color: def.sound === "shotgun" ? "#c23a2a" : "#d8a437",
      grav: 620, add: false,
      rot: Math.random() * 6.28,
      vrot: (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 14),
      rect: true,
    });

    const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const airborne = this.p.grounded ? 0 : 0.02;
    const spread = Math.max(
      0.005,
      def.spread + this.moveFactor() * def.spread * 0.9 + (sprinting ? 0.018 : 0)
        + this.recoil * 0.004 + airborne - this.crouchT * def.spread * 0.5
    );
    /* slightly generous hit detection when aiming without pointer lock */
    const hitR = this.locked ? 0.36 : 0.46;
    let anyHit = false;
    let anyHead = false;

    /* muzzle screen position for tracers */
    const tipX = pose.gx + Math.cos(pose.rot) * -200 * pose.s;
    const tipY = pose.gy + Math.sin(pose.rot) * -200 * pose.s;
    const mx0 = tipX * 0.3 + (this.W / 2) * 0.7;
    const my0 = tipY * 0.3 + (this.H / 2) * 0.7;
    const eye = this.eyeH();
    const magPlane = Math.hypot(this.planeX, this.planeY) || 0.66;

    for (let pel = 0; pel < def.pellets; pel++) {
      const ang = p.a + (Math.random() - 0.5) * 2 * spread;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const wallDist = Math.min(this.castGrid(p.x, p.y, dx, dy, def.range), def.range);

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
        anyHit = true;
        p.hits++;
        const pr = this.project(best.x, best.y);
        /* headshot: aim line (screen center) inside the top quarter of the sprite */
        let head = false;
        if (pr) {
          const hgt = (this.H / pr.ty) * 0.86 * best.scale;
          const bottom = this.horizon() + eye * (this.H / pr.ty);
          head = this.H / 2 < bottom - hgt * 0.74;
        }
        if (head) anyHead = true;
        const mult = head ? 1.9 : 1;
        best.hp -= (def.dmgLo + Math.random() * (def.dmgHi - def.dmgLo)) * mult;
        best.flash = 0.1;
        if (pr) {
          const hgt = (this.H / pr.ty) * 0.86 * best.scale;
          const bottom = this.horizon() + eye * (this.H / pr.ty);
          const hitY = bottom - hgt * (head ? 0.86 : 0.35 + Math.random() * 0.35);
          this.burst(pr.sx, hitY, def.pellets > 1 ? 4 : 8,
            head ? ["#ffe08a", "#c22f24", "#ff5b4d"] : ["#c22f24", "#8a1f1a", "#e05548"],
            150, 320, false);
          this.tracers.push({ x1: mx0, y1: my0, x2: pr.sx, y2: hitY, t: def.sound === "smg" ? 0.045 : 0.065 });
        }
        if (best.hp <= 0) {
          this.killEnemy(best);
          if (head) {
            this.floaters.push({
              x: best.x, y: best.y, z: 1.15, vz: 0.4, t: 1.0, max: 1.0,
              txt: "HEADSHOT", color: "#ffe08a", size: 14,
            });
          }
        }
      } else {
        /* wall impact sparks + tracer to the hit point on the wall */
        const wx = p.x + dx * wallDist * 0.97, wy = p.y + dy * wallDist * 0.97;
        const wpr = this.project(wx, wy);
        if (wpr) {
          const iy = this.horizon() + (eye - 0.42) * (this.H / wpr.ty);
          if (pel === 0 || Math.random() < 0.3) {
            this.burst(wpr.sx, iy, 5, ["#ffd28a", "#ffb02e", "#fff2c8"], 90, 0, true);
          }
          this.tracers.push({ x1: mx0, y1: my0, x2: wpr.sx, y2: iy, t: def.sound === "smg" ? 0.04 : 0.06 });
        } else if (pel === 0) {
          const rel = normAngle(ang - p.a);
          const col = clamp(Math.round(((Math.tan(rel) / magPlane + 1) / 2) * this.W), 0, this.W - 1);
          this.burst(col, this.horizon() + (Math.random() - 0.5) * this.H * 0.2, 5, ["#ffd28a", "#ffb02e", "#fff2c8"], 90, 0, true);
        }
      }
    }
    if (anyHit) {
      this.hitMark = { t: 0.16, kill: false };
      sfx.hit();
      if (anyHead) {
        sfx.headshot();
        this.onEvent({ type: "feed", text: "HEADSHOT — CRITICAL DAMAGE", color: "#ffe08a" });
      }
    }
    /* soft muzzle smoke (heavy for the shotgun, light otherwise) */
    const smkN = def.sound === "shotgun" ? 7 : def.sound === "rifle" ? 3 : 2;
    for (let i = 0; i < smkN; i++) {
      this.puff(
        mx0 + (Math.random() - 0.5) * 16, my0 + (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * (def.sound === "shotgun" ? 70 : 34),
        -20 - Math.random() * (def.sound === "shotgun" ? 55 : 30),
        (def.sound === "shotgun" ? 9 : 6) + Math.random() * 6, 3.2,
        def.sound === "shotgun" ? 0.16 : 0.1, "168,172,178",
        0.45 + Math.random() * 0.4
      );
    }
  }

  private puff(x: number, y: number, vx: number, vy: number, r: number, grow: number, alpha: number, rgb: string, life: number) {
    if (this.smoke.length > 60) this.smoke.shift();
    this.smoke.push({ x, y, vx, vy, t: life, max: life, r, grow, alpha, rgb });
  }

  /* soft dust kicked up by footsteps */
  private puffDust() {
    const W = this.W, H = this.H;
    const sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const n = sprint ? 3 : 2;
    for (let i = 0; i < n; i++) {
      this.puff(
        W * 0.5 + (Math.random() - 0.5) * W * 0.22,
        H * 0.9 + Math.random() * H * 0.06,
        (Math.random() - 0.5) * 30,
        -10 - Math.random() * 16,
        8 + Math.random() * 10, 2.4, 0.075, "150,158,148",
        0.5 + Math.random() * 0.3
      );
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
    this.corpses.push({ x: e.x, y: e.y, kind: e.kind, t: 0, scale: e.scale });
    if (this.corpses.length > 14) this.corpses.shift();
    /* persistent blood pool decal on the floor */
    this.decals.push({
      x: e.x + (Math.random() - 0.5) * 0.3,
      y: e.y + (Math.random() - 0.5) * 0.3,
      r: (0.34 + Math.random() * 0.22) * e.scale,
      seed: Math.random(), rot: Math.random() * Math.PI * 2,
    });
    if (this.decals.length > 40) this.decals.shift();
    const p = this.p;
    p.chain++;
    p.chainT = 3;
    p.kills++;
    const gained = e.points * this.mult();
    p.score += gained;
    /* floating score text in world space */
    this.floaters.push({
      x: e.x, y: e.y, z: 0.95, vz: 0.55, t: 1.15, max: 1.15,
      txt: `+${gained}`, color: "#ffb02e", size: 17,
    });
    if (this.floaters.length > 14) this.floaters.shift();
    this.hitMark = { t: 0.2, kill: true };
    this.shake = Math.min(10, this.shake + 2.5);
    sfx.kill();
    this.onEvent({
      type: "feed",
      text: `${KILL_WORDS[Math.floor(Math.random() * KILL_WORDS.length)]} · ${WEAPONS[this.wIdx].short}  +${gained}`,
      color: "#ffb02e",
    });
    const pr = this.project(e.x, e.y);
    if (pr) {
      const eye = this.eyeH();
      const hgt = (this.H / pr.ty) * 0.86 * e.scale;
      const bottom = this.horizon() + eye * (this.H / pr.ty);
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

  private damagePlayer(dmg: number, fx?: number, fy?: number) {
    if (this.dead || this.mode !== "play") return;
    const p = this.p;
    p.hp -= dmg;
    this.dmgFlash = 1;
    this.shake = Math.min(14, this.shake + 5);
    if (fx !== undefined && fy !== undefined) {
      this.dmgDirs.push({ ang: normAngle(Math.atan2(fy - p.y, fx - p.x) - p.a), t: 0.9 });
      if (this.dmgDirs.length > 5) this.dmgDirs.shift();
    }
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
      const eye = this.eyeH();
      const hgt = (this.H / pr.ty) * 0.86 * e.scale;
      const bottom = this.horizon() + eye * (this.H / pr.ty);
      this.tracers.push({
        x1: pr.sx - hgt * 0.3,
        y1: bottom - hgt * 0.55,
        x2: this.W / 2 + (Math.random() - 0.5) * 110,
        y2: this.horizon() + (Math.random() - 0.5) * 70,
        t: 0.12,
      });
    }
    /* crouching makes you a harder target */
    if (Math.random() < chance * (1 - 0.35 * this.crouchT)) this.damagePlayer(dmg, e.x, e.y);
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
    return this.H / 2 + this.pitch + this.recoilPitch + this.landDip + drop;
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
    this.meleeT = Math.max(0, this.meleeT - dt);
    this.meleeCd = Math.max(0, this.meleeCd - dt);
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

    /* crouch state */
    const k = this.keys;
    const ctrlHeld = k.has("ControlLeft") || k.has("ControlRight");
    const crouchTarget = this.crouchLock || ctrlHeld ? 1 : 0;
    this.crouchT += (crouchTarget - this.crouchT) * Math.min(1, dt * 12);
    if (crouchTarget === 1 && this.crouchT > 0.99) this.crouchT = 1;
    if (crouchTarget === 0 && this.crouchT < 0.01) this.crouchT = 0;

    /* player movement */
    const f = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const r = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    const sprinting = (k.has("ShiftLeft") || k.has("ShiftRight")) && f > 0 && this.crouchT < 0.4;
    const speed = (sprinting ? 4.5 : 2.9) * (1 - 0.45 * this.crouchT);
    let mx = this.dirX * f + -Math.sin(this.p.a) * r;
    let my = this.dirY * f + Math.cos(this.p.a) * r;
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      mx = (mx / len) * speed * dt;
      my = (my / len) * speed * dt;
      const rad = 0.26;
      if (!this.collides(p.x + mx, p.y, rad)) p.x += mx;
      if (!this.collides(p.x, p.y + my, rad)) p.y += my;
      p.x = clamp(p.x, 1.3, MW - 1.3);
      p.y = clamp(p.y, 1.3, MH - 1.3);
      if (p.grounded) {
        p.bobT += dt * speed * 1.75;
        const step = Math.floor(p.bobT / Math.PI);
        if (step !== p.lastStep) {
          p.lastStep = step;
          sfx.step();
          this.puffDust();
        }
      }
    }

    /* sprint FOV kick */
    const fovTarget = sprinting && len > 0.01 ? 1 : 0;
    this.fovKick += (fovTarget - this.fovKick) * Math.min(1, dt * 7);

    /* jump / gravity */
    p.vz -= 10.5 * dt;
    p.pz += p.vz * dt;
    if (p.pz <= 0) {
      if (!p.grounded) {
        this.shake = Math.min(10, this.shake + 1.6);
        this.landDip = 7;
        sfx.land();
      }
      p.pz = 0;
      p.vz = 0;
      p.grounded = true;
    } else {
      p.grounded = false;
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

    /* invisible edge assist (only when pointer lock is unavailable):
       if the hidden cursor reaches the window edge while you are actively
       pushing the mouse that way, the view keeps turning so you can spin
       past 180°. It only runs while the mouse actually moved recently and
       toward that edge — park the mouse anywhere and the view holds still
       (no runaway circle-spin). */
    if (
      !this.locked && this.mousePos.x >= 0 &&
      this.now - this.lastMoveT < 0.16 &&
      this.mousePos.x <= window.innerWidth && this.mousePos.y <= window.innerHeight
    ) {
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const m = 20;
      const cx = this.mousePos.x, cy = this.mousePos.y;
      const recent = 1 - clamp((this.now - this.lastMoveT) / 0.16, 0, 1);
      if (cx < m && this.moveVX < -1) this.p.a -= dt * 3.1 * (1 - Math.max(0, cx) / m) * recent;
      else if (cx > vw - m && this.moveVX > 1) this.p.a += dt * 3.1 * (1 - Math.max(0, vw - cx) / m) * recent;
      const pLim = this.H * 0.3;
      if (cy < m && this.moveVY < -1) this.pitch = clamp(this.pitch + dt * 150 * (1 - Math.max(0, cy) / m) * recent, -pLim, pLim);
      else if (cy > vh - m && this.moveVY > 1) this.pitch = clamp(this.pitch - dt * 150 * (1 - Math.max(0, vh - cy) / m) * recent, -pLim, pLim);
    }

    /* weapon sway — the gun trails your look input like a real weapon */
    const swayK = Math.min(1, dt * 9);
    this.swayX += (-this.lookDX * 0.55 - this.swayX) * swayK;
    this.swayY += (this.lookDY * 0.4 - this.swayY) * swayK;
    this.lookDX = 0;
    this.lookDY = 0;
    this.landDip = Math.max(0, this.landDip - dt * 22);

    /* firing — works with or without pointer lock */
    this.fireT -= dt;
    this.swapT = Math.min(1, this.swapT + dt * 3.4);
    const wdef = WEAPONS[this.wIdx];
    if (this.mouseDown && !p.reloading && this.swapT > 0.55) {
      if (this.mags[this.wIdx] > 0) {
        if (this.fireT <= 0 && (wdef.auto || this.triggerReady)) {
          this.fire();
          if (!wdef.auto) this.triggerReady = false;
        }
      } else if (this.fireT <= 0) {
        sfx.empty();
        this.startReload();
        this.fireT = 0.4;
      }
    }
    if (p.reloading) {
      p.reloadT += dt;
      if (p.reloadT >= wdef.reload) {
        p.reloading = false;
        this.mags[this.wIdx] = wdef.mag;
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
          this.damagePlayer((9 + this.wave) * (1 - 0.3 * this.crouchT), e.x, e.y);
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
      if (pa.vrot) pa.rot = (pa.rot ?? 0) + pa.vrot * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const fl = this.floaters[i];
      fl.t -= dt;
      fl.z += fl.vz * dt;
      fl.vz *= Math.pow(0.25, dt);
      if (fl.t <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const sm = this.smoke[i];
      sm.t -= dt;
      sm.x += sm.vx * dt;
      sm.y += sm.vy * dt;
      sm.vy -= 10 * dt;
      sm.vx *= Math.pow(0.4, dt);
      if (sm.t <= 0) this.smoke.splice(i, 1);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].t -= dt;
      if (this.tracers[i].t <= 0) this.tracers.splice(i, 1);
    }
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      this.corpses[i].t += dt;
      if (this.corpses[i].t > 0.9) this.corpses.splice(i, 1);
    }
    for (let i = this.dmgDirs.length - 1; i >= 0; i--) {
      this.dmgDirs[i].t -= dt;
      if (this.dmgDirs[i].t <= 0) this.dmgDirs.splice(i, 1);
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
    const ey = this.eyeH();
    const shx = (Math.random() - 0.5) * this.shake;
    const shy = (Math.random() - 0.5) * this.shake;

    ctx.save();
    ctx.translate(shx, shy);

    /* ceiling */
    const farD = 13;
    const ceilY = Math.max(1, horizon - (1 - ey) * (H / farD));
    const floorY = Math.min(H - 1, horizon + ey * (H / farD));
    let g = ctx.createLinearGradient(0, -40, 0, Math.max(1, ceilY));
    g.addColorStop(0, "#04060a");
    g.addColorStop(1, "#0b130e");
    ctx.fillStyle = g;
    ctx.fillRect(-20, -40, W + 40, Math.max(1, ceilY) + 40);
    /* far band (infinity, eaten by fog) */
    ctx.fillStyle = "#0a0f0c";
    ctx.fillRect(-20, ceilY, W + 40, Math.max(0, floorY - ceilY));
    /* floor */
    g = ctx.createLinearGradient(0, Math.max(0, floorY - 24), 0, H + 40);
    g.addColorStop(0, "#0d130e");
    g.addColorStop(1, "#20291d");
    ctx.fillStyle = g;
    ctx.fillRect(-20, floorY, W + 40, H - floorY + 60);
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
      const top = horizon - (1 - ey) * lineH;
      ctx.drawImage(this.textures[cell] ?? this.textures[0], texX, 0, 1, 64, x, top, 1, lineH);
      const fog = Math.min(0.94, perp / 16 + (side === 1 ? 0.13 : 0));
      if (fog > 0.03) {
        ctx.fillStyle = `rgba(4,7,6,${fog.toFixed(3)})`;
        ctx.fillRect(x, top, 1, lineH);
      }
      /* muzzle flash lights up nearby walls */
      if (this.muzzleT > 0 && perp < 6) {
        const li = this.muzzleT * 16 * (1 - perp / 6);
        ctx.fillStyle = `rgba(255,180,80,${clamp(li, 0, 0.4).toFixed(3)})`;
        ctx.fillRect(x, top, 1, lineH);
      }
    }

    /* blood decals on the floor */
    for (const dc of this.decals) {
      const pr = this.project(dc.x, dc.y);
      if (!pr) continue;
      const ty = pr.ty;
      if (this.zbuf[Math.floor(clamp(pr.sx, 0, W - 1))] < ty) continue;
      const scl = H / ty;
      const fy = horizon + ey * scl;
      const fade = clamp(1 - ty / 16, 0, 1);
      if (fade <= 0.02) continue;
      ctx.save();
      ctx.translate(pr.sx, fy);
      ctx.scale(1, 0.42);
      ctx.rotate(dc.rot);
      const R = dc.r * scl * 0.5;
      ctx.fillStyle = `rgba(96,10,10,${(0.5 * fade).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, R, R * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(140,16,12,${(0.45 * fade).toFixed(3)})`;
      for (let b = 0; b < 4; b++) {
        const ba = dc.seed * 6.28 + b * 1.7;
        const bx = Math.cos(ba) * R * 0.55;
        const by = Math.sin(ba) * R * 0.5;
        ctx.beginPath();
        ctx.ellipse(bx, by, R * (0.3 + ((dc.seed * (b + 2)) % 1) * 0.25), R * 0.28, ba, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    /* dust motes */
    ctx.globalCompositeOperation = "lighter";
    for (const du of this.dust) {
      const pr = this.project(du.x, du.y);
      if (!pr || pr.ty > 15) continue;
      const sz = clamp((H / pr.ty) * 0.012 * du.z, 0.6, 3.5);
      const a = 0.05 + 0.09 * (1 - pr.ty / 15);
      ctx.fillStyle = `rgba(190,225,190,${a.toFixed(3)})`;
      const dy = horizon + ey * (H / pr.ty) - (H / pr.ty) * du.z;
      ctx.fillRect(pr.sx, dy, sz, sz);
    }
    ctx.globalCompositeOperation = "source-over";

    /* sprites */
    type Item =
      | { ty: number; kind: "enemy"; e: Enemy }
      | { ty: number; kind: "pick"; pk: Pickup }
      | { ty: number; kind: "corpse"; c: { x: number; y: number; kind: EnemyKind; t: number; scale: number } };
    const items: Item[] = [];
    for (const e of this.enemies) {
      const pr = this.project(e.x, e.y);
      if (pr) items.push({ ty: pr.ty, kind: "enemy", e });
    }
    for (const c of this.corpses) {
      const pr = this.project(c.x, c.y);
      if (pr) items.push({ ty: pr.ty, kind: "corpse", c });
    }
    for (const pk of this.pickups) {
      const pr = this.project(pk.x, pk.y);
      if (pr) items.push({ ty: pr.ty, kind: "pick", pk });
    }
    items.sort((a, b) => b.ty - a.ty);

    for (const it of items) {
      if (it.kind === "corpse") {
        /* collapsing body: tilts, sinks and fades over ~0.9s */
        const c = it.c;
        const ty = it.ty;
        const pr = this.project(c.x, c.y);
        if (!pr) continue;
        const n = clamp(c.t / 0.9, 0, 1);
        const img = this.enemySprites[c.kind].walk[0];
        const hgt = (H / ty) * 0.86 * c.scale * (1 - n * 0.55);
        const wdt = hgt * (SW / SH) * (1 + n * 0.5);
        const bottom = horizon + ey * (H / ty);
        const startX = pr.sx - wdt / 2;
        const c0 = Math.max(0, Math.floor(startX));
        const c1 = Math.min(W - 1, Math.ceil(startX + wdt));
        const sww = Math.max(SW / wdt, 0.9);
        ctx.globalAlpha = (1 - n) * 0.9;
        for (let col = c0; col <= c1; col++) {
          if (this.zbuf[col] > ty + 0.05) {
            const srcX = clamp(((col - startX) / wdt) * SW, 0, SW - 1);
            ctx.drawImage(img, srcX, 0, sww, SH, col, bottom - hgt, 1, hgt);
          }
        }
        ctx.globalAlpha = 1;
        /* blood pool */
        ctx.fillStyle = `rgba(122,20,16,${(0.4 * (1 - n)).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(pr.sx, bottom - 1, wdt * 0.42, wdt * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.kind === "enemy") {
        const e = it.e;
        const ty = it.ty;
        const pr = this.project(e.x, e.y);
        if (!pr) continue;
        const sprites = this.enemySprites[e.kind];
        const img = e.flash > 0 ? sprites.hit : sprites.walk[Math.floor(e.animT * 5) % 2];
        const hgt = (H / ty) * 0.86 * e.scale;
        const wdt = hgt * (SW / SH);
        /* hit-flinch: a quick upward jolt when struck */
        const flinch = e.flash > 0 ? e.flash * 26 * (H / 430) : 0;
        const bottom = horizon + ey * (H / ty) - flinch;
        const startX = pr.sx - wdt / 2 + (e.flash > 0 ? (Math.random() - 0.5) * 3 : 0);
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
        const floorPos = horizon + ey * (H / ty);
        const bottom = floorPos - Math.abs(Math.sin(pk.t * 3)) * size * 0.28 - size * 0.06;
        const startX = pr.sx - size / 2;
        const c0 = Math.max(0, Math.floor(startX));
        const c1 = Math.min(W - 1, Math.ceil(startX + size));
        const sww = Math.max(36 / size, 0.9);
        /* glow pad */
        ctx.globalCompositeOperation = "lighter";
        const glowC = pk.kind === "medkit" ? "rgba(125,255,138,0.14)" : "rgba(255,176,46,0.14)";
        const gr2 = size * 0.8;
        const gg = ctx.createRadialGradient(pr.sx, floorPos, 0, pr.sx, floorPos, gr2);
        gg.addColorStop(0, glowC);
        gg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gg;
        ctx.fillRect(pr.sx - gr2, floorPos - gr2 * 0.4, gr2 * 2, gr2 * 0.8);
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
      if (pa.rect && pa.rot !== undefined) {
        ctx.save();
        ctx.translate(pa.x, pa.y);
        ctx.rotate(pa.rot);
        ctx.fillRect(-pa.size, -pa.size * 0.4, pa.size * 2, pa.size * 0.8);
        ctx.restore();
      } else {
        ctx.fillRect(pa.x - pa.size / 2, pa.y - pa.size / 2, pa.size, pa.size);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;

    /* floating combat text (score popups) */
    ctx.textAlign = "center";
    for (const fl of this.floaters) {
      const pr = this.project(fl.x, fl.y);
      if (!pr) continue;
      const scl = H / pr.ty;
      const a = clamp(fl.t / fl.max, 0, 1);
      const rise = (1 - a) * 0.35;
      const fy = horizon + (ey - fl.z - rise) * scl;
      const fs = clamp(fl.size * scl * 0.055, 10, 30);
      const fade = clamp(1 - pr.ty / 15, 0, 1);
      ctx.globalAlpha = a * fade;
      ctx.font = `700 ${fs.toFixed(1)}px Rajdhani, sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillText(fl.txt, pr.sx + 1, fy + 1);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.txt, pr.sx, fy);
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

    /* soft volumetric smoke */
    for (const sm of this.smoke) {
      const k = sm.t / sm.max;
      const rr = sm.r + sm.grow * sm.r * (1 - k);
      const a = sm.alpha * Math.sin(Math.PI * k);
      if (a <= 0.004) continue;
      const sg = ctx.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, rr);
      sg.addColorStop(0, `rgba(${sm.rgb},${a.toFixed(3)})`);
      sg.addColorStop(1, `rgba(${sm.rgb},0)`);
      ctx.fillStyle = sg;
      ctx.fillRect(sm.x - rr, sm.y - rr, rr * 2, rr * 2);
    }

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

    /* damage direction indicators */
    if (this.dmgDirs.length > 0 && !this.dead) {
      const cx = W / 2, cy = H / 2;
      const rad = Math.min(W, H) * 0.34;
      for (const d of this.dmgDirs) {
        const a = clamp(d.t / 0.9, 0, 1);
        const ang = d.ang - Math.PI / 2;
        const rg = ctx.createRadialGradient(cx, cy, rad * 0.7, cx, cy, rad * 1.18);
        rg.addColorStop(0, "rgba(255,40,28,0)");
        rg.addColorStop(1, `rgba(255,40,28,${(0.7 * a).toFixed(3)})`);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rad * 1.18, ang - 0.34, ang + 0.34);
        ctx.closePath();
        ctx.fill();
      }
    }

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
    const gap = 7 + this.moveFactor() * 5 + this.recoil * 11 + (sprinting ? 5 : 0)
      - this.crouchT * 3 + (this.p.grounded ? 0 : 7);
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 3;
    this.crossLines(ctx, cx, cy, gap, 8);
    ctx.stroke();
    ctx.strokeStyle = "rgba(240,255,240,0.92)";
    ctx.lineWidth = 1.4;
    this.crossLines(ctx, cx, cy, gap, 8);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,200,80,0.95)";
    ctx.fillRect(cx - 1, cy - 1, 2, 2);

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

    const def = WEAPONS[this.wIdx];
    const rt = this.p.reloading ? Math.sin(Math.PI * clamp(this.p.reloadT / def.reload, 0, 1)) : 0;

    if (this.wIdx === 0) this.drawRifleParts(ctx, rt);
    else if (this.wIdx === 1) this.drawSmgParts(ctx, rt);
    else this.drawShotgunParts(ctx, rt);

    /* muzzle flash */
    if (this.muzzleT > 0) {
      ctx.globalCompositeOperation = "lighter";
      const mx = this.wIdx === 1 ? -138 : this.wIdx === 2 ? -204 : -206;
      const my = -1;
      const r1 = (26 + Math.random() * 10) * def.flash;
      const fg = ctx.createRadialGradient(mx, my, 0, mx, my, r1);
      fg.addColorStop(0, "rgba(255,247,214,0.98)");
      fg.addColorStop(0.35, "rgba(255,176,46,0.8)");
      fg.addColorStop(1, "rgba(255,120,20,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(mx - r1, my - r1, r1 * 2, r1 * 2);
      ctx.fillStyle = "rgba(255,230,160,0.9)";
      ctx.beginPath();
      const spikes = this.wIdx === 2 ? 6 : 4;
      for (let i = 0; i < spikes; i++) {
        const a = (i * Math.PI * 2) / spikes + Math.random() * 0.3;
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a) * r1 * 1.4, my + Math.sin(a) * r1 * 1.4);
        ctx.lineTo(mx + Math.cos(a + 0.3) * r1 * 0.5, my + Math.sin(a + 0.3) * r1 * 0.5);
      }
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();

    /* combat knife slash (screen space) */
    if (this.meleeT > 0) {
      const t = 1 - this.meleeT / 0.26;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const cx = this.W * 0.5, cy = this.H * 0.66;
      const rad = this.H * 0.44;
      const a0 = -2.5 + t * 2.0;
      const sweepA = 0.5;
      ctx.strokeStyle = `rgba(220,240,255,${(0.75 * (1 - t * 0.5)).toFixed(3)})`;
      ctx.lineWidth = 3 + (1 - t) * 4;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, a0, a0 + sweepA);
      ctx.stroke();
      ctx.strokeStyle = `rgba(150,200,255,${(0.3 * (1 - t)).toFixed(3)})`;
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 0.92, a0 - 0.12, a0 + sweepA);
      ctx.stroke();
      const ba = a0 + sweepA;
      const bx = cx + Math.cos(ba) * rad, by = cy + Math.sin(ba) * rad;
      ctx.fillStyle = "#dfe9f2";
      ctx.translate(bx, by);
      ctx.rotate(ba + Math.PI / 2 + 0.5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(7, -36);
      ctx.lineTo(-5, -32);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------------------------- viewmodels ---------------------------- */

  private drawRifleParts(ctx: CanvasRenderingContext2D, rt: number) {
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
    ctx.fillRect(-9, rt * 46, 20, 34);
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
  }

  private drawSmgParts(ctx: CanvasRenderingContext2D, rt: number) {
    /* wire stock */
    ctx.save();
    ctx.translate(80, 0);
    ctx.rotate(0.28);
    ctx.fillStyle = "#171a20";
    ctx.fillRect(0, -3, 56, 7);
    ctx.fillRect(48, -3, 7, 22);
    ctx.restore();
    /* compact receiver */
    ctx.fillStyle = "#1e2228";
    ctx.fillRect(10, -13, 70, 26);
    ctx.fillStyle = "#0e1013";
    ctx.fillRect(24, -7, 20, 7);
    ctx.fillStyle = "rgba(154,205,50,0.8)";
    ctx.fillRect(12, -13, 66, 3);
    /* red-dot sight */
    ctx.fillStyle = "#23272e";
    ctx.fillRect(22, -25, 30, 12);
    ctx.fillStyle = "#0b0d0f";
    ctx.fillRect(28, -22, 18, 7);
    ctx.fillStyle = "#b8e63c";
    ctx.beginPath();
    ctx.arc(37, -18.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    /* short barrel + suppressor-style muzzle */
    ctx.fillStyle = "#23272e";
    ctx.fillRect(-124, -6, 134, 11);
    ctx.fillStyle = "#14171c";
    ctx.fillRect(-136, -8, 14, 15);
    ctx.fillStyle = "#2b3038";
    ctx.fillRect(-60, -9, 8, 3);
    ctx.fillRect(-36, -9, 8, 3);
    /* big angled mag (drops on reload) */
    ctx.save();
    ctx.translate(30, 12);
    ctx.rotate(0.42 + rt * 0.5);
    ctx.fillStyle = "#262b31";
    ctx.fillRect(-8, rt * 46, 17, 32);
    ctx.fillStyle = "#14171c";
    ctx.fillRect(-8, 25 + rt * 46, 17, 6);
    ctx.restore();
    /* foregrip */
    ctx.save();
    ctx.translate(-46, 6);
    ctx.rotate(-0.12);
    ctx.fillStyle = "#1a1e23";
    ctx.fillRect(-5, 0, 11, 22);
    ctx.restore();
    /* trigger grip */
    ctx.save();
    ctx.translate(72, 10);
    ctx.rotate(-0.26);
    ctx.fillStyle = "#1a1e23";
    ctx.fillRect(-7, 0, 14, 28);
    ctx.restore();
    /* hands */
    ctx.fillStyle = "#20262b";
    ctx.beginPath();
    ctx.arc(-42, 12, 11, 0, Math.PI * 2);
    ctx.arc(56, 19, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(-60, -6, 138, 2);
  }

  private drawShotgunParts(ctx: CanvasRenderingContext2D, rt: number) {
    /* wooden stock */
    ctx.fillStyle = "#6e4a1e";
    ctx.fillRect(86, -12, 44, 26);
    ctx.fillStyle = "#4a3214";
    ctx.fillRect(86, 6, 44, 8);
    ctx.fillStyle = "#14171c";
    ctx.fillRect(126, -14, 9, 30);
    /* receiver */
    ctx.fillStyle = "#24282e";
    ctx.fillRect(4, -14, 84, 28);
    ctx.fillStyle = "#0e1013";
    ctx.fillRect(30, -8, 24, 8);
    ctx.fillStyle = "rgba(255,159,28,0.8)";
    ctx.fillRect(8, -14, 76, 3);
    /* side saddle shells */
    ctx.fillStyle = "#a33226";
    ctx.fillRect(12, -5, 8, 15);
    ctx.fillRect(24, -5, 8, 15);
    ctx.fillStyle = "#d8a437";
    ctx.fillRect(12, 7, 8, 4);
    ctx.fillRect(24, 7, 8, 4);
    /* barrel + tube */
    ctx.fillStyle = "#2b3038";
    ctx.fillRect(-200, -9, 204, 12);
    ctx.fillStyle = "#1c2026";
    ctx.fillRect(-184, 3, 188, 9);
    ctx.fillStyle = "#14171c";
    ctx.fillRect(-204, -10, 8, 14);
    /* bead sight */
    ctx.fillStyle = "#ffb02e";
    ctx.beginPath();
    ctx.arc(-196, -12, 2.4, 0, Math.PI * 2);
    ctx.fill();
    /* pump handle — slides back while reloading */
    ctx.save();
    ctx.translate(-96 + rt * 26, 0);
    ctx.fillStyle = "#6e4a1e";
    ctx.fillRect(0, -4, 42, 20);
    ctx.fillStyle = "#4a3214";
    ctx.fillRect(6, -1, 4, 14);
    ctx.fillRect(16, -1, 4, 14);
    ctx.fillRect(26, -1, 4, 14);
    ctx.restore();
    /* grip */
    ctx.save();
    ctx.translate(76, 12);
    ctx.rotate(-0.3);
    ctx.fillStyle = "#4a3214";
    ctx.fillRect(-7, 0, 15, 26);
    ctx.restore();
    /* hands */
    ctx.fillStyle = "#20262b";
    ctx.beginPath();
    ctx.arc(-66 + rt * 26, 8, 12, 0, Math.PI * 2);
    ctx.arc(60, 20, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(-200, -9, 286, 2);
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
