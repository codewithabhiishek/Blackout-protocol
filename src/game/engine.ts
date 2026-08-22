/* BLACKOUT PROTOCOL — raycast FPS engine. All rendering procedural on a 2D canvas. */

import {
  makeWallTextures,
  makeEnemySprites,
  makePickupSprites,
  SW,
  SH,
  type EnemyKind,
  type ArenaTheme,
} from "./textures";
import { sfx } from "./audio";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface HudData {
  hp: number;
  ap: number;
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
  arena: string;
  arenaId: string;
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

interface Pickup { x: number; y: number; kind: "medkit" | "rapid" | "armor"; t: number }
interface ScreenPart {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
  grav: number; add: boolean;
  rot?: number; vrot?: number; rect?: boolean;
}
interface Tracer { x1: number; y1: number; x2: number; y2: number; t: number }
interface Dust { x: number; y: number; z: number; vx: number; vy: number }

/* ------------------------------------------------------------------ */
/* Multi-Arena System                                                  */
/* ------------------------------------------------------------------ */

export interface ArenaDef {
  id: string;
  name: string;
  sub: string;
  theme: ArenaTheme;
  rows: string[];
  spawnCells: Array<[number, number]>;
  medkitNodes: Array<[number, number]>;
  armorNodes: Array<[number, number]>;
  playerStart: { x: number; y: number; a: number };
  colors: {
    ceiling: string;
    ceilingGrad: string;
    floor: string;
    floorGrad: string;
    minimapBg: string;
  };
}

export const ARENAS: Record<string, ArenaDef> = {
  sector7: {
    id: "sector7",
    name: "SECTOR 7 COMPOUND",
    sub: "INDUSTRIAL BLACKOUT FACILITY",
    theme: "sector7",
    playerStart: { x: 11.5, y: 11.5, a: 0 },
    colors: {
      ceiling: "#0b130e",
      ceilingGrad: "#04060a",
      floor: "#141a16",
      floorGrad: "#20291d",
      minimapBg: "rgba(10,16,12,0.9)",
    },
    rows: [
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
    ],
    spawnCells: [
      [1.5, 1.5], [22.5, 1.5], [1.5, 22.5], [22.5, 22.5],
      [9.5, 1.5], [14.5, 22.5], [1.5, 12.5], [22.5, 12.5],
      [6.5, 6.5], [17.5, 6.5], [6.5, 17.5], [17.5, 17.5],
      [12.5, 5.5], [5.5, 12.5], [18.5, 12.5], [12.5, 18.5],
    ],
    medkitNodes: [
      [3.5, 5.5], [20.5, 5.5], [3.5, 18.5], [20.5, 18.5],
      [5.5, 1.5], [18.5, 1.5], [5.5, 22.5], [18.5, 22.5],
      [7.5, 11.5], [16.5, 11.5],
    ],
    armorNodes: [
      [1.5, 9.5], [22.5, 9.5], [1.5, 14.5], [22.5, 14.5],
      [11.5, 7.5], [11.5, 16.5],
    ],
  },
  cybernexus: {
    id: "cybernexus",
    name: "CYBER NEXUS",
    sub: "NEO-TOKYO SKYLINE ROOFTOP",
    theme: "cybernexus",
    playerStart: { x: 11.5, y: 11.5, a: -Math.PI / 2 },
    colors: {
      ceiling: "#080c14",
      ceilingGrad: "#020408",
      floor: "#0e1626",
      floorGrad: "#1a2538",
      minimapBg: "rgba(8,16,28,0.92)",
    },
    rows: [
      "########################",
      "#......TT......TT......#",
      "#..MM......##......MM..#",
      "#..MM..CC..##..CC..MM..#",
      "#......CC......CC......#",
      "#..HH..............HH..#",
      "#..HH....T....T....HH..#",
      "#........T....T........#",
      "#..##..................#",
      "#..##......CC......##..#",
      "#......M...CC...M..##..#",
      "#..TT..M...P....M..TT..#",
      "#..TT..M........M..TT..#",
      "#......M...CC...M......#",
      "#..##......CC......##..#",
      "#..##..................#",
      "#........T....T........#",
      "#..HH....T....T....HH..#",
      "#..HH..............HH..#",
      "#......CC......CC......#",
      "#..MM..CC..##..CC..MM..#",
      "#..MM......##......MM..#",
      "#......TT......TT......#",
      "########################",
    ],
    spawnCells: [
      [2.5, 2.5], [21.5, 2.5], [2.5, 21.5], [21.5, 21.5],
      [11.5, 2.5], [11.5, 21.5], [2.5, 11.5], [21.5, 11.5],
      [5.5, 8.5], [18.5, 8.5], [5.5, 15.5], [18.5, 15.5],
    ],
    medkitNodes: [
      [2.5, 6.5], [21.5, 6.5], [2.5, 17.5], [21.5, 17.5],
      [11.5, 4.5], [11.5, 19.5],
    ],
    armorNodes: [
      [7.5, 11.5], [16.5, 11.5], [11.5, 8.5], [11.5, 15.5],
    ],
  },
  bunker: {
    id: "bunker",
    name: "BUNKER 404",
    sub: "DESERT FORTIFIED OUTPOST",
    theme: "bunker",
    playerStart: { x: 11.5, y: 11.5, a: Math.PI },
    colors: {
      ceiling: "#1e1610",
      ceilingGrad: "#0c0805",
      floor: "#2d2319",
      floorGrad: "#423425",
      minimapBg: "rgba(28,20,14,0.92)",
    },
    rows: [
      "########################",
      "#..CC..............CC..#",
      "#..CC..MM..##..MM..CC..#",
      "#......MM..##..MM......#",
      "#..HH..............HH..#",
      "#..HH...C......C...HH..#",
      "#.......C..TT..C.......#",
      "#..........TT..........#",
      "#..MM..##......##..MM..#",
      "#..MM..##......##..MM..#",
      "#..........CC..........#",
      "#..TT..C...P...C...TT..#",
      "#..TT..C.......C...TT..#",
      "#..........CC..........#",
      "#..MM..##......##..MM..#",
      "#..MM..##......##..MM..#",
      "#..........TT..........#",
      "#.......C..TT..C.......#",
      "#..HH...C......C...HH..#",
      "#..HH..............HH..#",
      "#......MM..##..MM......#",
      "#..CC..MM..##..MM..CC..#",
      "#..CC..............CC..#",
      "########################",
    ],
    spawnCells: [
      [1.5, 3.5], [22.5, 3.5], [1.5, 20.5], [22.5, 20.5],
      [6.5, 1.5], [17.5, 1.5], [6.5, 22.5], [17.5, 22.5],
      [1.5, 11.5], [22.5, 11.5], [11.5, 3.5], [11.5, 20.5],
    ],
    medkitNodes: [
      [3.5, 8.5], [20.5, 8.5], [3.5, 15.5], [20.5, 15.5],
      [11.5, 1.5], [11.5, 22.5],
    ],
    armorNodes: [
      [5.5, 11.5], [18.5, 11.5], [11.5, 6.5], [11.5, 17.5],
    ],
  },
};

const LEGEND: Record<string, number> = { "#": 1, M: 2, C: 3, H: 4, T: 5 };
const MW = 24;
const MH = 24;

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
  /* ---------------- viewmodel pose (WeaponConfig) ----------------
     Centralized so the barrel provably lies along the shoulder→aim line.
     barrel     : local barrel length (the muzzle is drawn at -barrel).
     anchorX/Y  : the shoulder/rear anchor as fractions of the screen. The
                  recede direction is derived from (aim → anchor), so the
                  barrel always points at the crosshair — never a magic angle.
     muzzlePull : px the muzzle sits short of the aim point along the barrel
                  line, so the gun doesn't cover the crosshair it aims down.
     holdRot    : a *documented* base-rotation correction. All three weapons
                  are authored with their forward axis along local -X, so this
                  is 0 — kept only for assets whose native axis differs.      */
  pose: {
    barrel: number;
    anchorX: number;
    anchorY: number;
    muzzlePull: number;
    holdRot: number;
  };
}

export const WEAPONS: WeaponDef[] = [
  {
    /* precise semi-auto marksman rifle — one deliberate shot per trigger pull */
    name: "PHANTOM MK-IV", short: "RIFLE", fireMode: "SEMI-AUTO",
    mag: 24, interval: 0.17, auto: false,
    dmgLo: 34, dmgHi: 48, pellets: 1,
    spread: 0.005, recoil: 1.25, shake: 2.4, kick: 4.2,
    reload: 1.6, range: 40, flash: 1, sound: "rifle",
    pose: { barrel: 215, anchorX: 0.74, anchorY: 1.04, muzzlePull: 42, holdRot: 0 },
  },
  {
    /* full-auto PDW — hold the trigger and spray */
    name: "SCORPION PDW", short: "SMG", fireMode: "FULL-AUTO",
    mag: 40, interval: 0.06, auto: true,
    dmgLo: 12, dmgHi: 19, pellets: 1,
    spread: 0.022, recoil: 0.5, shake: 1.2, kick: 1.5,
    reload: 1.2, range: 30, flash: 0.7, sound: "smg",
    pose: { barrel: 175, anchorX: 0.72, anchorY: 1.03, muzzlePull: 36, holdRot: 0 },
  },
  {
    /* 8-pellet pump blast — shreds at close range */
    name: "JUDGE-12", short: "SHOTGUN", fireMode: "PUMP-ACTION",
    mag: 6, interval: 0.85, auto: false,
    dmgLo: 11, dmgHi: 17, pellets: 8,
    spread: 0.085, recoil: 1.7, shake: 6, kick: 8,
    reload: 2.1, range: 10, flash: 1.7, sound: "shotgun",
    pose: { barrel: 225, anchorX: 0.76, anchorY: 1.05, muzzlePull: 46, holdRot: 0 },
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
  private arenaId = "sector7";
  private spawnX = 11.5;
  private spawnY = 11.5;
  private spawnA = 0;

  private mode: "idle" | "play" = "idle";
  private paused = false;
  private dead = false;
  private deathT = 0;
  private overSent = false;
  locked = false;

  private p = {
    x: 11.5, y: 11.5, a: 0, hp: 100, ap: 50,
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
  /* recoil is a damped spring (position + velocity) so the kick is temporary
     and always returns to the neutral aiming pose — never a permanent tilt */
  private recoilV = 0;
  /* dev-only aim debugger: press ` (backquote) to visualize aim ray, muzzle
     point and last impact. Off by default, hidden in normal play. */
  private debugAim = false;
  private lastImpact: { x: number; y: number } | null = null;
  private lastPose: { tipX: number; tipY: number; gx: number; gy: number } | null = null;
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
  private emergencyDropCd = 0;
  private startTime = 0;
  private now = 0;

  private keys = new Set<string>();
  private mouseDown = false;
  private aimDownSights = false;
  private zoomT = 0;
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

    this.enemySprites = makeEnemySprites();
    this.pickupSprites = makePickupSprites();
    this.textures = makeWallTextures("sector7");
    this.loadArena("sector7");

    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("pointerlockchange", this.onPlc);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("focus", this.onFocus);
    this.canvas.addEventListener("contextmenu", this.onCtx);
    document.addEventListener("wheel", this.onWheel, { passive: false });

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  loadArena(arenaId: string) {
    this.arenaId = ARENAS[arenaId] ? arenaId : "sector7";
    const arena = ARENAS[this.arenaId];
    for (let y = 0; y < MH; y++) {
      const row = (arena.rows[y] ?? "").padEnd(MW, "#").slice(0, MW);
      for (let x = 0; x < MW; x++) {
        const ch = row[x];
        if (ch === "P") {
          this.spawnX = x + 0.5;
          this.spawnY = y + 0.5;
        }
        this.grid[y * MW + x] = LEGEND[ch] ?? 0;
      }
    }
    this.spawnA = arena.playerStart.a;
    this.textures = makeWallTextures(arena.theme);
    this.miniWalls = null;
  }

  setArena(arenaId: string) {
    this.loadArena(arenaId);
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
    window.removeEventListener("focus", this.onFocus);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
    document.removeEventListener("wheel", this.onWheel);
    sfx.stopAmbient();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  /* ---------------------------- public API ---------------------------- */

  startGame(arenaId?: string) {
    if (arenaId && ARENAS[arenaId]) {
      this.loadArena(arenaId);
    }
    const arena = ARENAS[this.arenaId] ?? ARENAS.sector7;
    const p = this.p;
    p.x = this.spawnX; p.y = this.spawnY; p.a = this.spawnA;
    p.hp = 100; p.ap = 50; p.reloading = false; p.reloadT = 0;
    this.wIdx = 0; this.mags = [WEAPONS[0].mag, WEAPONS[1].mag, WEAPONS[2].mag];
    this.swapT = 1; this.triggerReady = true;
    p.chain = 0; p.chainT = 0; p.score = 0; p.kills = 0; p.shots = 0; p.hits = 0;
    p.rapidT = 0; p.bobT = 0;
    p.pz = 0; p.vz = 0; p.grounded = true;
    this.pitch = 0; this.recoilPitch = 0; this.shake = 0; this.dmgFlash = 0;
    this.muzzleT = 0; this.recoil = 0; this.recoilV = 0; this.fireT = 0;
    this.lastImpact = null;
    this.crouchT = 0; this.crouchLock = false;
    this.meleeT = 0; this.meleeCd = 0; this.fovKick = 0;
    this.enemies = []; this.pickups = []; this.parts = []; this.tracers = [];
    this.corpses = []; this.dmgDirs = [];
    this.decals = []; this.floaters = []; this.smoke = [];
    this.keys.clear();
    this.mouseDown = false;
    this.aimDownSights = false;
    this.zoomT = 0;
    this.lookDX = 0;
    this.lookDY = 0;
    this.moveVX = 0;
    this.moveVY = 0;
    this.wave = 0; this.waveActive = false; this.waveDelay = 2.0;
    this.emergencyDropCd = 0;
    this.dead = false; this.deathT = 0; this.overSent = false;
    this.paused = false; this.mode = "play";
    this.startTime = performance.now();
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
    // Pre-spawn medkit caches & armor plates across arena
    for (let i = 0; i < 3; i++) this.spawnMedkit();
    for (let i = 0; i < 2; i++) this.spawnArmorPlate();
    sfx.startAmbient();
    this.onEvent({ type: "banner", title: arena.name, sub: arena.sub });
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
    this.keys.clear();
    this.mouseDown = false;
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
    this.keys.clear();
    this.mouseDown = false;
    this.aimDownSights = false;
    this.zoomT = 0;
    this.lookDX = 0;
    this.lookDY = 0;
    this.moveVX = 0;
    this.moveVY = 0;
    sfx.stopAmbient();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
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
    if (this.mode === "play" && !this.paused && !this.dead) {
      this.keys.add(e.code);
      if (e.key) this.keys.add(e.key.toLowerCase());
      if (e.code === "KeyR" || e.key === "r" || e.key === "R") this.startReload();
      if (e.code === "Space" || e.key === " ") this.tryJump();
      if (e.code === "KeyC" || e.key === "c" || e.key === "C") this.crouchLock = !this.crouchLock;
      if (e.code === "KeyV" || e.code === "KeyE" || e.key === "v" || e.key === "e") this.tryMelee();
      if (e.code === "Digit1" || e.key === "1") this.switchWeapon(0);
      if (e.code === "Digit2" || e.key === "2") this.switchWeapon(1);
      if (e.code === "Digit3" || e.key === "3") this.switchWeapon(2);
      if (e.code === "KeyQ" || e.key === "q" || e.key === "Q") this.switchWeapon((this.wIdx + 1) % WEAPONS.length);
    }
    if (e.code === "KeyF" || e.key === "f" || e.key === "F") this.toggleFullscreen();
    if (e.code === "KeyZ" || e.key === "z" || e.key === "Z") this.aimDownSights = !this.aimDownSights;
    if ((e.code === "KeyP" || e.key === "p" || e.key === "P") && this.mode === "play" && !this.dead) {
      if (this.paused) this.resumeGame();
      else if (this.locked) document.exitPointerLock();
      else {
        this.paused = true;
        this.onEvent({ type: "pause" });
      }
    }
    /* dev-only aim debugger — hidden in normal play */
    if (e.code === "Backquote") this.debugAim = !this.debugAim;
    if (e.code === "KeyM" || e.key === "m" || e.key === "M") this.toggleMute();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.key) this.keys.delete(e.key.toLowerCase());
  };

  private onMouseMove = (e: MouseEvent) => {
    const inWin =
      e.clientX >= 0 && e.clientX <= window.innerWidth &&
      e.clientY >= 0 && e.clientY <= window.innerHeight;
    this.mousePos.x = e.clientX;
    this.mousePos.y = e.clientY;
    if (this.mode === "play" && !this.paused && !this.dead) {
      const pLim = this.H * 0.3;
      const sens = 1 - 0.45 * this.zoomT;
      if (this.locked) {
        /* true pointer-lock mouse look */
        this.p.a += e.movementX * 0.0026 * sens;
        this.pitch = clamp(this.pitch - e.movementY * 0.75 * sens, -pLim, pLim);
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
          this.p.a += dx * 0.0026 * sens;
          this.pitch = clamp(this.pitch - dy * 0.75 * sens, -pLim, pLim);
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
    e.preventDefault();
    window.focus?.();
    this.prevMouse.x = e.clientX;
    this.prevMouse.y = e.clientY;
    if (e.button === 0) {
      this.mouseDown = true;
      this.triggerReady = true;
    } else if (e.button === 2) {
      this.aimDownSights = true;
    }
    if (this.mode === "play" && !this.locked && !this.paused && !this.dead) this.requestLock();
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
    else if (e.button === 2) this.aimDownSights = false;
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
    this.aimDownSights = false;
    this.lookDX = 0;
    this.lookDY = 0;
    this.moveVX = 0;
    this.moveVY = 0;
  };

  private onFocus = () => {
    this.keys.clear();
    this.lookDX = 0;
    this.lookDY = 0;
    this.moveVX = 0;
    this.moveVY = 0;
  };

  /* ---------------------------- helpers ---------------------------- */

  private solid(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return true;
    return this.grid[cy * MW + cx] > 0;
  }

  private collides(x: number, y: number, r: number): boolean {
    const minX = Math.floor(x - r);
    const maxX = Math.floor(x + r);
    const minY = Math.floor(y - r);
    const maxY = Math.floor(y + r);

    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        if (this.solid(cx, cy)) {
          const nearestX = clamp(x, cx, cx + 1);
          const nearestY = clamp(y, cy, cy + 1);
          const dx = x - nearestX;
          const dy = y - nearestY;
          if (dx * dx + dy * dy < r * r) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private resolveCollision(px: number, py: number, r: number = 0.22): { x: number; y: number } {
    let x = px;
    let y = py;

    for (let pass = 0; pass < 3; pass++) {
      const minX = Math.floor(x - r - 0.1);
      const maxX = Math.floor(x + r + 0.1);
      const minY = Math.floor(y - r - 0.1);
      const maxY = Math.floor(y + r + 0.1);

      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          if (!this.solid(cx, cy)) continue;

          const nearestX = clamp(x, cx, cx + 1);
          const nearestY = clamp(y, cy, cy + 1);
          const dx = x - nearestX;
          const dy = y - nearestY;
          const d2 = dx * dx + dy * dy;

          if (d2 < r * r) {
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2);
              const overlap = r - d;
              x += (dx / d) * overlap;
              y += (dy / d) * overlap;
            } else {
              const leftDist = x - cx;
              const rightDist = cx + 1 - x;
              const topDist = y - cy;
              const bottomDist = cy + 1 - y;
              const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
              if (minDist === leftDist) x = cx - r - 0.001;
              else if (minDist === rightDist) x = cx + 1 + r + 0.001;
              else if (minDist === topDist) y = cy - r - 0.001;
              else y = cy + 1 + r + 0.001;
            }
          }
        }
      }
    }

    x = clamp(x, 1.25, MW - 1.25);
    y = clamp(y, 1.25, MH - 1.25);
    return { x, y };
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
    const zoomMags = [0.28, 0.44, 0.50];
    const targetZoomMag = zoomMags[this.wIdx] ?? 0.40;
    const baseMag = 0.66 + this.fovKick * 0.13 - this.crouchT * 0.03;
    const mag = baseMag + (targetZoomMag - baseMag) * this.zoomT;
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
    const arena = ARENAS[this.arenaId] ?? ARENAS.sector7;
    this.onHud({
      hp: Math.max(0, Math.ceil(this.p.hp)),
      ap: Math.max(0, Math.ceil(this.p.ap)),
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
      arena: arena.name,
      arenaId: arena.id,
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
      const resolvedB = this.resolveCollision(best.x + kx, best.y + ky, 0.28);
      best.x = resolvedB.x;
      best.y = resolvedB.y;
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

  /* Geometric aiming pose. The viewmodel and the firing system share one
     authoritative aim direction — the camera's line of sight through the
     screen center. The barrel is constructed to lie exactly on that line:

       aim point (screen center + pitch)      ← where the raycast fires
              ▲
              │  barrel (drawn along local -X)
              │
       muzzle ┘  (sits muzzlePull px short of aim so it doesn't block it)
        \
         \  receiver trails back to the shoulder anchor (bottom-right)
          \
       shoulder anchor

     Because rotation = atan2(shoulder − muzzle) and the muzzle sits on the
     aim→shoulder segment, extending the barrel forward always passes through
     the crosshair. No hardcoded "points up" angle is possible.             */
  private gunPose() {
    const p = this.p;
    const s = this.H / 430;
    const def = WEAPONS[this.wIdx];
    const cfg = def.pose;
    const moving = this.moveFactor();
    const rt = p.reloading ? Math.sin(Math.PI * clamp(p.reloadT / def.reload, 0, 1)) : 0;
    const swap = Math.sin((1 - this.swapT) * Math.PI * 0.5) * 60;
    const idle = moving > 0.4 ? 0 : 1;
    const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const sprint = sprinting && moving > 0.4 ? 1 : 0;

    /* ---- movement / feel offsets (rigid translation of the whole gun) ---- */
    const bobMult = 1 - 0.75 * this.zoomT;
    const bobX = Math.sin(p.bobT) * 7 * moving * bobMult;
    const bobY = Math.abs(Math.cos(p.bobT)) * 8 * moving * bobMult;
    const breathX = Math.sin(this.now * 1.5) * 1.8 * idle * bobMult;
    const breathY = Math.cos(this.now * 2.1) * 1.4 * idle * bobMult;
    const swayX = clamp(this.swayX, -26, 26) * 0.5 * bobMult;
    const swayY = clamp(this.swayY, -18, 18) * 0.5 * bobMult;
    const crouchDrop = this.crouchT * 26 * s * (1 - 0.5 * this.zoomT);
    const jumpLift = p.pz * 55 * s * (1 - 0.5 * this.zoomT);
    const reloadDrop = rt * 90 + swap;
    const sprintDrop = sprint * 14 * (1 - this.zoomT);

    /* ---- aim point = screen center (where the hitscan fires) ---- */
    const aimX = this.W / 2 + bobX + swayX + breathX;
    const aimY = this.H / 2 - this.pitch * 0.12 + bobY + swayY + breathY
      + crouchDrop - jumpLift + reloadDrop * 0.3 + sprintDrop;

    /* ---- shoulder anchor: when zoomed, aligns to center for true ADS sightline ---- */
    const rawAnchorX = this.W * cfg.anchorX;
    const rawAnchorY = this.H * cfg.anchorY;
    const adsAnchorX = this.W * (this.wIdx === 0 ? 0.505 : this.wIdx === 1 ? 0.515 : 0.53);
    const adsAnchorY = this.H * 1.01;

    const curAnchorX = rawAnchorX + (adsAnchorX - rawAnchorX) * this.zoomT;
    const curAnchorY = rawAnchorY + (adsAnchorY - rawAnchorY) * this.zoomT;

    const anchorX = curAnchorX + bobX + swayX * 1.5 + breathX;
    const anchorY = curAnchorY + bobY + swayY * 1.5 + breathY
      + crouchDrop - jumpLift + reloadDrop + sprintDrop;

    /* barrel recede direction: from the aim point back toward the shoulder */
    let dx = anchorX - aimX, dy = anchorY - aimY;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;

    /* muzzle sits muzzlePull px from the aim point along the barrel line */
    const curMuzzlePull = cfg.muzzlePull + (24 - cfg.muzzlePull) * this.zoomT;
    const tipX = aimX + dx * curMuzzlePull;
    const tipY = aimY + dy * curMuzzlePull;

    /* fixed barrel length (no size pulsing); receiver = muzzle + dir*length */
    const barrelLen = cfg.barrel * s;
    /* recoil spring pushes the stock back along the barrel axis */
    const recoilBack = this.recoil * (26 * (1 - 0.4 * this.zoomT));
    const gx = tipX + dx * (barrelLen + recoilBack);
    const gy = tipY + dy * (barrelLen + recoilBack);

    /* rotation: local -X (barrel) points from shoulder to muzzle = at the aim */
    const rot = Math.atan2(dy, dx) + cfg.holdRot
      + this.recoil * 0.055 * (1 - 0.4 * this.zoomT)
      + rt * 0.5
      + sprint * 0.12 * (1 - this.zoomT)
      + clamp(this.swayX, -26, 26) * 0.003;

    this.lastPose = { tipX, tipY, gx, gy };
    return { gx, gy, rot, s, tipX, tipY, barrelLen: cfg.barrel };
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
    /* spring impulse — the kick peaks quickly and damps back to neutral */
    this.recoilV += def.recoil * 9;
    this.muzzleT = 0.055;
    this.shake = Math.min(14, this.shake + def.shake);
    this.recoilPitch -= def.kick;
    this.fireT = def.interval * (p.rapidT > 0 ? 0.62 : 1);
    if (def.sound === "smg") sfx.shootSmg();
    else if (def.sound === "shotgun") sfx.shootShotgun();
    else sfx.shoot();

    const pose = this.gunPose();
    /* eject casing from the ejection port, up and to the right */
    const ejA = pose.rot - Math.PI; /* barrel direction */
    const ejX = pose.gx + Math.cos(ejA) * 60 * pose.s;
    const ejY = pose.gy + Math.sin(ejA) * 60 * pose.s - 14 * pose.s;
    this.parts.push({
      x: ejX, y: ejY,
      vx: 130 + Math.random() * 110, vy: -190 - Math.random() * 70,
      life: 0.75, maxLife: 0.75,
      size: def.sound === "shotgun" ? 3.4 : 2.5,
      color: def.sound === "shotgun" ? "#c23a2a" : "#d8a437",
      grav: 640, add: false,
      rot: Math.random() * 6.28,
      vrot: (Math.random() > 0.5 ? 1 : -1) * (12 + Math.random() * 16),
      rect: true,
    });

    const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const airborne = this.p.grounded ? 0 : 0.02;
    const spread = Math.max(
      0.002,
      (def.spread + this.moveFactor() * def.spread * 0.9 + (sprinting ? 0.018 : 0)
        + this.recoil * 0.004 + airborne - this.crouchT * def.spread * 0.5) * (1 - 0.72 * this.zoomT)
    );
    /* slightly generous hit detection when aiming without pointer lock */
    const hitR = this.locked ? 0.36 : 0.46;
    let anyHit = false;
    let anyHead = false;

    /* true muzzle-tip position (on the line of fire) for tracers & smoke */
    const mx0 = pose.tipX;
    const my0 = pose.tipY;
    const cx = this.W / 2;
    const cy = this.H / 2;
    const eye = this.eyeH();
    const magPlane = Math.hypot(this.planeX, this.planeY) || 0.66;

    for (let pel = 0; pel < def.pellets; pel++) {
      const angSpread = (Math.random() - 0.5) * 2 * spread;
      const vertSpread = (Math.random() - 0.5) * 2 * spread * (this.H / this.W);
      const ang = p.a + angSpread;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const wallDist = Math.min(this.castGrid(p.x, p.y, dx, dy, def.range), def.range);

      const aimScreenX = cx + (angSpread / magPlane) * (this.W * 0.5);
      const aimScreenY = cy + vertSpread * this.H;

      let best: Enemy | null = null;
      let bestT = Infinity;
      let bestHead = false;
      let bestHitY = cy;

      for (const e of this.enemies) {
        const ex = e.x - p.x, ey = e.y - p.y;
        const t = ex * dx + ey * dy;
        if (t > 0.25 && t < wallDist && t < bestT) {
          const pr = this.project(e.x, e.y);
          if (pr && pr.ty > 0.15) {
            // 1. Z-Buffer occlusion check: wall in front takes the bullet
            const col = Math.floor(clamp(aimScreenX, 0, this.W - 1));
            if (this.zbuf[col] !== undefined && this.zbuf[col] < pr.ty - 0.08) {
              continue;
            }

            const hgt = (this.H / pr.ty) * 0.86 * e.scale;
            const wdt = hgt * (SW / SH);
            const bottom = this.horizon() + eye * (this.H / pr.ty);
            const top = bottom - hgt;

            // 2. Strict vertical bounds: Must be within [top, bottom]
            const inVert = aimScreenY >= top && aimScreenY <= bottom;
            if (!inVert) continue;

            // 3. Strict horizontal silhouette: Head (top 24%) is narrower than Torso
            const isHead = aimScreenY <= top + hgt * 0.24;
            const maxHalfW = isHead ? wdt * 0.32 : wdt * 0.44;
            const inHoriz = Math.abs(aimScreenX - pr.sx) <= maxHalfW;

            if (inHoriz) {
              best = e;
              bestT = t;
              bestHead = isHead;
              bestHitY = clamp(aimScreenY, top + 1, bottom - 1);
            }
          }
        }
      }

      if (best) {
        anyHit = true;
        p.hits++;
        const pr = this.project(best.x, best.y)!;
        const head = bestHead;
        if (head) anyHead = true;
        const mult = head ? 1.9 : 1;
        best.hp -= (def.dmgLo + Math.random() * (def.dmgHi - def.dmgLo)) * mult;
        best.flash = 0.1;
        this.burst(
          pr.sx, bestHitY, def.pellets > 1 ? 4 : 8,
          head ? ["#ffe08a", "#c22f24", "#ff5b4d"] : ["#c22f24", "#8a1f1a", "#e05548"],
          150, 320, false
        );
        this.tracers.push({ x1: mx0, y1: my0, x2: pr.sx, y2: bestHitY, t: def.sound === "smg" ? 0.045 : 0.065 });
        if (pel === 0) this.lastImpact = { x: pr.sx, y: bestHitY };

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
          const iy = clamp(aimScreenY, 0, this.H);
          if (pel === 0 || Math.random() < 0.3) {
            this.burst(wpr.sx, iy, 5, ["#ffd28a", "#ffb02e", "#fff2c8"], 90, 0, true);
          }
          this.tracers.push({ x1: mx0, y1: my0, x2: wpr.sx, y2: iy, t: def.sound === "smg" ? 0.04 : 0.06 });
          if (pel === 0) this.lastImpact = { x: wpr.sx, y: iy };
        } else if (pel === 0) {
          const rel = normAngle(ang - p.a);
          const col = clamp(Math.round(((Math.tan(rel) / magPlane + 1) / 2) * this.W), 0, this.W - 1);
          this.burst(col, clamp(aimScreenY, 0, this.H), 5, ["#ffd28a", "#ffb02e", "#fff2c8"], 90, 0, true);
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
    const isLowHp = this.p.hp < 60;
    const dropRate = isLowHp ? 0.85 : 0.65;
    if (e.kind === "heavy") {
      // Heavies always drop Armor Plates
      this.pickups.push({
        x: e.x, y: e.y,
        kind: "armor",
        t: 0,
      });
    } else if (Math.random() < dropRate) {
      const medChance = isLowHp ? 0.75 : 0.55;
      const rand = Math.random();
      const kind: "medkit" | "rapid" | "armor" =
        rand < medChance ? "medkit" : rand < medChance + 0.25 ? "armor" : "rapid";
      this.pickups.push({
        x: e.x, y: e.y,
        kind,
        t: 0,
      });
    }
  }

  private damagePlayer(dmg: number, fx?: number, fy?: number) {
    if (this.dead || this.mode !== "play") return;
    const p = this.p;

    let tookArmor = false;
    if (p.ap > 0) {
      tookArmor = true;
      const absorb = Math.min(p.ap, Math.round(dmg * 0.65));
      p.ap -= absorb;
      const remDmg = dmg - absorb;
      p.hp -= remDmg;
      if (p.ap <= 0) {
        this.floaters.push({
          x: p.x, y: p.y, z: 1.1, vz: 0.5, t: 1.0, max: 1.0,
          txt: "ARMOR BROKEN", color: "#00d4ff", size: 14,
        });
        sfx.armorBreak();
      } else {
        sfx.armorHit();
      }
    } else {
      p.hp -= dmg;
      sfx.hurt();
    }

    this.dmgFlash = 1;
    this.shake = Math.min(14, this.shake + (tookArmor ? 3.5 : 5));
    if (fx !== undefined && fy !== undefined) {
      this.dmgDirs.push({ ang: normAngle(Math.atan2(fy - p.y, fx - p.x) - p.a), t: 0.9 });
      if (this.dmgDirs.length > 5) this.dmgDirs.shift();
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.dead = true;
      this.deathT = 1.5;
      this.mouseDown = false;
      this.aimDownSights = false;
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

  /* ---------------------------- supplies & waves ---------------------------- */

  private spawnMedkit(x?: number, y?: number) {
    if (x !== undefined && y !== undefined) {
      this.pickups.push({ x, y, kind: "medkit", t: Math.random() * 5 });
      return;
    }
    const arena = ARENAS[this.arenaId] ?? ARENAS.sector7;
    const candidates = arena.medkitNodes.filter(([nx, ny]) => {
      if (this.solid(Math.floor(nx), Math.floor(ny))) return false;
      return !this.pickups.some((pk) => Math.hypot(pk.x - nx, pk.y - ny) < 2.0);
    });

    if (candidates.length > 0) {
      const idx = Math.floor(Math.random() * candidates.length);
      const [nx, ny] = candidates[idx];
      this.pickups.push({ x: nx, y: ny, kind: "medkit", t: Math.random() * 5 });
    } else {
      const sc = arena.spawnCells[Math.floor(Math.random() * arena.spawnCells.length)];
      this.pickups.push({ x: sc[0], y: sc[1], kind: "medkit", t: Math.random() * 5 });
    }
  }

  private spawnArmorPlate(x?: number, y?: number) {
    if (x !== undefined && y !== undefined) {
      this.pickups.push({ x, y, kind: "armor", t: Math.random() * 5 });
      return;
    }
    const arena = ARENAS[this.arenaId] ?? ARENAS.sector7;
    const nodes = arena.armorNodes.length > 0 ? arena.armorNodes : arena.medkitNodes;
    const candidates = nodes.filter(([nx, ny]) => {
      if (this.solid(Math.floor(nx), Math.floor(ny))) return false;
      return !this.pickups.some((pk) => Math.hypot(pk.x - nx, pk.y - ny) < 2.0);
    });

    if (candidates.length > 0) {
      const idx = Math.floor(Math.random() * candidates.length);
      const [nx, ny] = candidates[idx];
      this.pickups.push({ x: nx, y: ny, kind: "armor", t: Math.random() * 5 });
    } else {
      const sc = arena.spawnCells[Math.floor(Math.random() * arena.spawnCells.length)];
      this.pickups.push({ x: sc[0], y: sc[1], kind: "armor", t: Math.random() * 5 });
    }
  }

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
    const arena = ARENAS[this.arenaId] ?? ARENAS.sector7;
    const cells = [...arena.spawnCells]
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
    // Ensure arena is restocked with medkits and armor plates each wave
    const activeMedkits = this.pickups.filter((pk) => pk.kind === "medkit").length;
    const medkitsToSpawn = Math.max(2, 3 - activeMedkits);
    for (let i = 0; i < medkitsToSpawn; i++) {
      this.spawnMedkit();
    }
    const activeArmor = this.pickups.filter((pk) => pk.kind === "armor").length;
    if (activeArmor < 2) {
      for (let i = 0; i < 2 - activeArmor; i++) {
        this.spawnArmorPlate();
      }
    }
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
    /* damped spring recoil: kicks back/up, then smoothly returns to neutral
       (temporary — the weapon never stays tilted upward after firing) */
    this.recoilV += (-90 * this.recoil - 12 * this.recoilV) * dt;
    this.recoil += this.recoilV * dt;
    if (this.recoil < 0) { this.recoil = 0; this.recoilV = Math.max(0, this.recoilV); }
    this.recoil = Math.min(this.recoil, 1.25);
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

    /* ADS Zoom Interpolation */
    const targetZoom = this.aimDownSights && !p.reloading && this.swapT >= 0.8 ? 1.0 : 0.0;
    this.zoomT += (targetZoom - this.zoomT) * Math.min(1, dt * 14);
    if (Math.abs(this.zoomT - targetZoom) < 0.004) this.zoomT = targetZoom;

    this.updateDir();

    /* crouch state */
    const k = this.keys;
    const ctrlHeld = k.has("ControlLeft") || k.has("ControlRight");
    const crouchTarget = this.crouchLock || ctrlHeld ? 1 : 0;
    this.crouchT += (crouchTarget - this.crouchT) * Math.min(1, dt * 12);
    if (crouchTarget === 1 && this.crouchT > 0.99) this.crouchT = 1;
    if (crouchTarget === 0 && this.crouchT < 0.01) this.crouchT = 0;

    /* player movement */
    const f =
      (k.has("KeyW") || k.has("w") || k.has("ArrowUp") ? 1 : 0) -
      (k.has("KeyS") || k.has("s") || k.has("ArrowDown") ? 1 : 0);
    const r =
      (k.has("KeyD") || k.has("d") || k.has("ArrowRight") ? 1 : 0) -
      (k.has("KeyA") || k.has("a") || k.has("ArrowLeft") ? 1 : 0);
    const sprinting =
      (k.has("ShiftLeft") || k.has("ShiftRight") || k.has("shift")) && f > 0 && this.crouchT < 0.4;
    const speed = (sprinting ? 4.5 : 2.9) * (1 - 0.45 * this.crouchT);
    let mx = this.dirX * f + -Math.sin(this.p.a) * r;
    let my = this.dirY * f + Math.cos(this.p.a) * r;
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      mx = (mx / len) * speed * dt;
      my = (my / len) * speed * dt;
      const res = this.resolveCollision(p.x + mx, p.y + my, 0.22);
      p.x = res.x;
      p.y = res.y;
      if (p.grounded) {
        p.bobT += dt * speed * 1.75;
        const step = Math.floor(p.bobT / Math.PI);
        if (step !== p.lastStep) {
          p.lastStep = step;
          sfx.step();
          this.puffDust();
        }
      }
    } else {
      const fixed = this.resolveCollision(p.x, p.y, 0.22);
      p.x = fixed.x;
      p.y = fixed.y;
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

    /* enemies push player smoothly with delta-time */
    for (const e of this.enemies) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.62 && d > 0.001) {
        const pushForce = Math.min(2.0, (0.62 - d) * 3.0) * dt;
        const res = this.resolveCollision(p.x + (dx / d) * pushForce, p.y + (dy / d) * pushForce, 0.22);
        p.x = res.x;
        p.y = res.y;
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
      /* separation with other enemies */
      for (const o of this.enemies) {
        if (o === e) continue;
        const sx = e.x - o.x, sy = e.y - o.y;
        const sd = Math.hypot(sx, sy);
        if (sd < 0.6 && sd > 0.001) {
          vx += (sx / sd) * 1.4;
          vy += (sy / sd) * 1.4;
        }
      }
      /* soft push from player */
      const pdx = e.x - p.x, pdy = e.y - p.y;
      const pdist = Math.hypot(pdx, pdy);
      if (pdist < 0.55 && pdist > 0.001) {
        vx += (pdx / pdist) * 1.5;
        vy += (pdy / pdist) * 1.5;
      }
      const resolvedE = this.resolveCollision(e.x + vx * dt, e.y + vy * dt, 0.28);
      e.x = resolvedE.x;
      e.y = resolvedE.y;
    }

    /* pickups */
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < 0.7) {
        this.pickups.splice(i, 1);
        if (pk.kind === "medkit") {
          sfx.pickup();
          p.hp = Math.min(100, p.hp + 40);
          this.onEvent({ type: "feed", text: "MEDKIT ACQUIRED  +40 HP", color: "#7dff8a" });
        } else if (pk.kind === "armor") {
          sfx.armorPickup();
          p.ap = Math.min(100, p.ap + 50);
          this.onEvent({ type: "feed", text: "ARMOR PLATE EQUIPPED  +50 AP", color: "#00d4ff" });
        } else {
          sfx.pickup();
          p.rapidT = 8;
          this.onEvent({ type: "feed", text: "RAPID FIRE  8s", color: "#ffb02e" });
        }
      }
    }

    // Emergency medkit drop if critical HP (< 35) and no medkits on the map
    if (p.hp < 35 && !this.pickups.some((pk) => pk.kind === "medkit") && this.waveActive) {
      this.emergencyDropCd = (this.emergencyDropCd || 0) - dt;
      if (this.emergencyDropCd <= 0) {
        this.spawnMedkit();
        this.emergencyDropCd = 12.0;
        this.onEvent({ type: "feed", text: "EMERGENCY SUPPLY: MEDKIT AIRDROP", color: "#7dff8a" });
      }
    } else {
      this.emergencyDropCd = Math.max(0, (this.emergencyDropCd || 0) - dt);
    }

    /* waves */
    if (this.waveActive && this.enemies.length === 0) {
      this.waveActive = false;
      const bonus = 200 * this.wave;
      p.score += bonus;
      p.hp = Math.min(100, p.hp + 25);
      p.ap = Math.min(100, p.ap + 25);
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
    const arena = ARENAS[this.arenaId] ?? ARENAS.sector7;
    const farD = 13;
    const ceilY = Math.max(1, horizon - (1 - ey) * (H / farD));
    const floorY = Math.min(H - 1, horizon + ey * (H / farD));
    let g = ctx.createLinearGradient(0, -40, 0, Math.max(1, ceilY));
    g.addColorStop(0, arena.colors.ceilingGrad);
    g.addColorStop(1, arena.colors.ceiling);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -40, W + 40, Math.max(1, ceilY) + 40);
    /* far band (infinity, eaten by fog) */
    ctx.fillStyle = arena.colors.ceiling;
    ctx.fillRect(-20, ceilY, W + 40, Math.max(0, floorY - ceilY));
    /* floor */
    g = ctx.createLinearGradient(0, Math.max(0, floorY - 24), 0, H + 40);
    g.addColorStop(0, arena.colors.floor);
    g.addColorStop(1, arena.colors.floorGrad);
    ctx.fillStyle = g;
    ctx.fillRect(-20, floorY, W + 40, H - floorY + 60);
    /* horizon haze */
    ctx.fillStyle = arena.theme === "cybernexus" ? "rgba(0,212,255,0.06)" : arena.theme === "bunker" ? "rgba(255,120,40,0.06)" : "rgba(255,176,46,0.05)";
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

    /* dev-only aim debugger (toggle with ` ) — verifies that the camera aim
       ray, the visual barrel line and the actual impact all coincide. */
    if (this.debugAim && this.lastPose) {
      const lp = this.lastPose;
      const aimX = W / 2, aimY = H / 2 + this.pitch;
      ctx.save();
      ctx.lineWidth = 1.5;
      /* barrel / line-of-fire: muzzle -> aim point */
      ctx.strokeStyle = "rgba(80,220,255,0.9)";
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(lp.tipX, lp.tipY);
      ctx.lineTo(aimX, aimY);
      ctx.stroke();
      ctx.setLineDash([]);
      /* muzzle point */
      ctx.fillStyle = "#50dcff";
      ctx.beginPath(); ctx.arc(lp.tipX, lp.tipY, 4, 0, Math.PI * 2); ctx.fill();
      /* aim point */
      ctx.strokeStyle = "#ffd24a";
      ctx.beginPath(); ctx.arc(aimX, aimY, 6, 0, Math.PI * 2); ctx.stroke();
      /* last impact */
      if (this.lastImpact) {
        ctx.strokeStyle = "#ff5b4d";
        ctx.beginPath();
        ctx.moveTo(this.lastImpact.x - 6, this.lastImpact.y - 6);
        ctx.lineTo(this.lastImpact.x + 6, this.lastImpact.y + 6);
        ctx.moveTo(this.lastImpact.x + 6, this.lastImpact.y - 6);
        ctx.lineTo(this.lastImpact.x - 6, this.lastImpact.y + 6);
        ctx.stroke();
      }
      ctx.font = "700 11px Rajdhani, sans-serif";
      ctx.fillStyle = "#50dcff";
      ctx.fillText("AIM DEBUG — ` to close", 10, 16);
      ctx.fillStyle = "#9fe8ff";
      ctx.fillText(`muzzle(${Math.round(lp.tipX)},${Math.round(lp.tipY)})  aim(${Math.round(aimX)},${Math.round(aimY)})`, 10, 30);
      ctx.restore();
    }
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const cx = W / 2, cy = H / 2;

    /* 1. Tactical Scope Overlays when aiming down sights */
    if (this.zoomT > 0.04) {
      const z = this.zoomT;
      const R = H * (this.wIdx === 0 ? 0.38 : this.wIdx === 1 ? 0.43 : 0.47);

      ctx.save();

      // Outer darkened peripheral scope mask
      ctx.fillStyle = `rgba(4, 7, 10, ${(0.86 * z).toFixed(3)})`;
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
      ctx.fill();

      // Scope lens metallic rim & optic glass bevel
      ctx.strokeStyle = `rgba(255, 176, 46, ${(0.7 * z).toFixed(3)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(0, 220, 255, ${(0.35 * z).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R - 3, 0, Math.PI * 2);
      ctx.stroke();

      if (this.wIdx === 0) {
        // PHANTOM MK-IV: 2.2× Marksman Tactical Holographic Scope
        ctx.strokeStyle = `rgba(255, 55, 40, ${(0.92 * z).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        // Crosshairs with center gap
        ctx.beginPath();
        ctx.moveTo(cx - R * 0.88, cy); ctx.lineTo(cx - 8, cy);
        ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + R * 0.88, cy);
        ctx.moveTo(cx, cy - R * 0.88); ctx.lineTo(cx, cy - 8);
        ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + R * 0.88);
        ctx.stroke();

        // Rangefinder & sub-mil hash marks
        ctx.lineWidth = 1;
        for (let d = 22; d < R * 0.82; d += 22) {
          ctx.beginPath();
          ctx.moveTo(cx - d, cy - 3.5); ctx.lineTo(cx - d, cy + 3.5);
          ctx.moveTo(cx + d, cy - 3.5); ctx.lineTo(cx + d, cy + 3.5);
          ctx.moveTo(cx - 3.5, cy + d); ctx.lineTo(cx + 3.5, cy + d);
          ctx.stroke();
        }

        // Center illuminated red dot with neon glow
        ctx.fillStyle = `rgba(255, 55, 40, ${(0.98 * z).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255, 55, 40, ${(0.45 * z).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();

        // Tactical HUD readouts inside scope lens
        ctx.font = "700 11px Rajdhani, monospace";
        ctx.fillStyle = `rgba(255, 176, 46, ${(0.85 * z).toFixed(3)})`;
        ctx.fillText("2.2× MAG", cx - R * 0.72, cy - R * 0.45);
        ctx.fillText("EOTECH MK-IV", cx + R * 0.28, cy - R * 0.45);
      } else if (this.wIdx === 1) {
        // SCORPION PDW: Green High-Visibility CQB Holographic Optic
        ctx.strokeStyle = `rgba(130, 255, 60, ${(0.92 * z).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(130, 255, 60, ${(0.98 * z).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();

        // 4 cardinal optic tabs
        ctx.beginPath();
        ctx.moveTo(cx - 32, cy); ctx.lineTo(cx - 24, cy);
        ctx.moveTo(cx + 24, cy); ctx.lineTo(cx + 32, cy);
        ctx.moveTo(cx, cy - 32); ctx.lineTo(cx, cy - 24);
        ctx.moveTo(cx, cy + 24); ctx.lineTo(cx, cy + 32);
        ctx.stroke();

        ctx.font = "700 10px Rajdhani, monospace";
        ctx.fillStyle = `rgba(130, 255, 60, ${(0.8 * z).toFixed(3)})`;
        ctx.fillText("1.5× CQB", cx - 22, cy - 26);
      } else {
        // JUDGE-12: Amber Combat Shotgun Spread Ring
        ctx.strokeStyle = `rgba(255, 176, 46, ${(0.92 * z).toFixed(3)})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(cx, cy, 32, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(255, 176, 46, ${(0.95 * z).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();

        ctx.font = "700 10px Rajdhani, monospace";
        ctx.fillStyle = `rgba(255, 176, 46, ${(0.8 * z).toFixed(3)})`;
        ctx.fillText("12GA MAGNUM", cx - 32, cy - 38);
      }

      ctx.restore();
    }

    /* 2. Hipfire crosshair (fades out as zoom approaches 1.0) */
    if (this.zoomT < 0.95) {
      const alpha = 1 - this.zoomT;
      ctx.save();
      ctx.globalAlpha = alpha;

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

      ctx.restore();
    }

    /* 3. Hit marker */
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

    /* 4. Chain multiplier */
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
    /* gunPose returns barrelLen already in local (pre-scale) units — the
       muzzle is drawn at -bl, then the scale(s) maps it onto the aim line */
    const bl = pose.barrelLen;
    ctx.save();
    ctx.translate(pose.gx, pose.gy);
    ctx.rotate(pose.rot);
    ctx.scale(s, s);

    const def = WEAPONS[this.wIdx];
    const rt = this.p.reloading ? Math.sin(Math.PI * clamp(this.p.reloadT / def.reload, 0, 1)) : 0;

    if (this.wIdx === 0) this.drawRifleParts(ctx, rt, bl);
    else if (this.wIdx === 1) this.drawSmgParts(ctx, rt, bl);
    else this.drawShotgunParts(ctx, rt, bl);

    /* muzzle flash at the true barrel tip, elongated along the barrel (-X,
       i.e. into the screen toward the aim point) — not a symmetric blob */
    if (this.muzzleT > 0) {
      ctx.globalCompositeOperation = "lighter";
      const mx = -bl;
      const my = this.wIdx === 2 ? -4 : -1;
      const r1 = (22 + Math.random() * 9) * def.flash;
      /* hot core */
      const fg = ctx.createRadialGradient(mx, my, 0, mx, my, r1 * 0.9);
      fg.addColorStop(0, "rgba(255,250,225,0.98)");
      fg.addColorStop(0.4, "rgba(255,190,70,0.85)");
      fg.addColorStop(1, "rgba(255,120,20,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(mx, my, r1 * 0.9, 0, Math.PI * 2);
      ctx.fill();
      /* directional cone + star spikes biased forward along -X */
      ctx.fillStyle = "rgba(255,225,150,0.9)";
      ctx.beginPath();
      const spikes = this.wIdx === 2 ? 6 : 5;
      for (let i = 0; i < spikes; i++) {
        /* center the spike fan around PI (the -X / forward direction) */
        const a = Math.PI + (i - (spikes - 1) / 2) * 0.5 + (Math.random() - 0.5) * 0.2;
        const len = r1 * (i === Math.floor(spikes / 2) ? 1.9 : 1.1) * (0.8 + Math.random() * 0.4);
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a) * len, my + Math.sin(a) * len);
        ctx.lineTo(mx + Math.cos(a + 0.22) * len * 0.4, my + Math.sin(a + 0.22) * len * 0.4);
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

  /* Realistic tactical operator glove with carbon knuckle plate & stitching */
  private drawGlove(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    rot: number, size: number,
    isSupport: boolean = false
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const s = size / 20;
    ctx.scale(s, s);

    // Arm sleeve with camo dark fabric
    const gArm = ctx.createLinearGradient(-16, -14, -16, 24);
    gArm.addColorStop(0, "#222a32");
    gArm.addColorStop(0.5, "#161b20");
    gArm.addColorStop(1, "#0d1014");
    ctx.fillStyle = gArm;
    ctx.beginPath();
    ctx.roundRect(-24, -14, 28, 38, [6, 0, 0, 6]);
    ctx.fill();

    // Glove cuff strap & buckle
    ctx.fillStyle = "#2c3640";
    ctx.fillRect(-6, -14, 8, 38);
    ctx.fillStyle = "#485666";
    ctx.fillRect(-4, 0, 4, 10);

    // Main glove palm & back
    const gHand = ctx.createLinearGradient(0, -12, 0, 18);
    gHand.addColorStop(0, "#2b343e");
    gHand.addColorStop(0.5, "#1b2128");
    gHand.addColorStop(1, "#12161b");
    ctx.fillStyle = gHand;
    ctx.beginPath();
    ctx.ellipse(8, 2, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Carbon-fiber armored knuckle guard
    ctx.fillStyle = "#0c0f13";
    ctx.beginPath();
    ctx.roundRect(4, -8, 8, 20, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Reinforced finger joints & wraps
    ctx.fillStyle = "#1e242c";
    for (let f = 0; f < 4; f++) {
      const fy = -6 + f * 5.2;
      ctx.beginPath();
      ctx.ellipse(17, fy, 5, 2.4, isSupport ? -0.2 : 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14181e";
      ctx.fillRect(14, fy - 1.2, 4, 2.4);
    }

    // Thumb wrap
    ctx.fillStyle = "#222a32";
    ctx.beginPath();
    ctx.ellipse(3, 14, 6, 3.5, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* Perspective-foreshortened metal part: a trapezoid narrower at the muzzle */
  private trapMetal(
    ctx: CanvasRenderingContext2D,
    xFar: number, xNear: number, cy: number,
    hFar: number, hNear: number, c1: string, c2: string
  ) {
    const g = ctx.createLinearGradient(0, cy - hNear, 0, cy + hNear);
    g.addColorStop(0, c1);
    g.addColorStop(0.4, c2);
    g.addColorStop(0.85, "#13171d");
    g.addColorStop(1, "#0a0c0f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(xFar, cy - hFar);
    ctx.lineTo(xNear, cy - hNear);
    ctx.lineTo(xNear, cy + hNear);
    ctx.lineTo(xFar, cy + hFar);
    ctx.closePath();
    ctx.fill();

    /* top edge highlight = specular depth cue */
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(xFar, cy - hFar);
    ctx.lineTo(xNear, cy - hNear);
    ctx.lineTo(xNear, cy - hNear + 1.8);
    ctx.lineTo(xFar, cy - hFar + 1.8);
    ctx.closePath();
    ctx.fill();
  }

  /* Photorealistic AR-Style Marksman Battle Rifle (PHANTOM MK-IV) */
  private drawRifleParts(ctx: CanvasRenderingContext2D, rt: number, bl: number) {
    const metal = (x: number, y: number, w: number, h: number, c1: string, c2: string, bevel = 2) => {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, c1);
      g.addColorStop(0.45, c2);
      g.addColorStop(1, "#0d1014");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, bevel);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, y, w, 1.2);
    };

    /* ---------- Tactical Stock (Polymer + Rubber Cheek Riser) ---------- */
    metal(82, -11, 48, 24, "#2b323a", "#1b2026", 4);
    ctx.fillStyle = "#121519";
    ctx.fillRect(82, -12, 48, 5); /* cheek rest */
    ctx.fillStyle = "#0a0c0e";
    ctx.fillRect(124, -13, 9, 29); /* grooved rubber buttpad */
    for (let by = -9; by < 13; by += 4) {
      ctx.fillStyle = "#1c2228";
      ctx.fillRect(125, by, 7, 2);
    }
    // Buffer tube with adjustment pin holes
    metal(68, -6, 18, 13, "#343d48", "#222830", 1);
    ctx.fillStyle = "#121519";
    ctx.beginPath();
    ctx.arc(76, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();

    /* ---------- Upper Receiver & Machined Picatinny Rail ---------- */
    metal(0, -16, 74, 18, "#3e4854", "#252c34", 3);
    // Rail teeth on receiver top with metallic highlights
    ctx.fillStyle = "#171c22";
    for (let x = 2; x < 72; x += 6) {
      ctx.fillRect(x, -19, 4, 3.5);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(x, -19, 4, 0.8);
      ctx.fillStyle = "#171c22";
    }

    // Ejection Port & Bolt Carrier Group
    ctx.fillStyle = "#0c0e11";
    ctx.fillRect(28, -11, 24, 10);
    ctx.fillStyle = "#586472"; /* chrome bolt */
    ctx.fillRect(32, -9, 18, 6);
    ctx.fillStyle = "#d4a836"; /* polished brass casing visible */
    ctx.fillRect(35, -8, 8, 4);
    ctx.fillStyle = "#323a44"; /* brass deflector */
    ctx.fillRect(52, -13, 6, 12);

    // Laser engraved tactical markings
    ctx.font = "bold 4.5px Rajdhani, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText("BLACKOUT MK-IV", 6, -3);
    ctx.fillStyle = "rgba(255,176,46,0.5)";
    ctx.fillText("CAL 7.62", 6, 1);

    /* ---------- Holographic Reflex Combat Sight (EOTech Style) ---------- */
    // Armored Optic Hood
    metal(16, -35, 38, 17, "#28303a", "#181d23", 3);
    ctx.fillStyle = "#101418";
    ctx.fillRect(20, -32, 30, 11);
    // Anti-reflective coated cyan lens glass
    const gLens = ctx.createLinearGradient(20, -32, 50, -21);
    gLens.addColorStop(0, "rgba(20,120,180,0.35)");
    gLens.addColorStop(0.5, "rgba(40,200,240,0.15)");
    gLens.addColorStop(1, "rgba(20,120,180,0.4)");
    ctx.fillStyle = gLens;
    ctx.fillRect(20, -32, 30, 11);

    // Optic mounting screws & windage turret
    ctx.fillStyle = "#4a5664";
    ctx.beginPath();
    ctx.arc(17, -26, 2, 0, Math.PI * 2);
    ctx.arc(53, -26, 2, 0, Math.PI * 2);
    ctx.fill();

    // Illuminated holographic reticle (65 MOA ring + center dot with bloom)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,50,35,0.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(35, -26.5, 4.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ff3828";
    ctx.beginPath();
    ctx.arc(35, -26.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,50,35,0.3)";
    ctx.beginPath();
    ctx.arc(35, -26.5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* ---------- Lower Receiver, Magwell & Match Trigger ---------- */
    metal(2, 2, 70, 15, "#2d353f", "#1c2228", 2);
    ctx.fillStyle = "#20262e";
    ctx.fillRect(18, 14, 30, 6); /* flared magwell */
    // Trigger guard + match trigger
    ctx.strokeStyle = "#171c22";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(46, 16);
    ctx.quadraticCurveTo(56, 28, 66, 16);
    ctx.stroke();
    ctx.fillStyle = "#d8a437"; /* competition gold trigger */
    ctx.fillRect(54, 16, 2.5, 7);
    // Selector switch (SEMI position)
    ctx.fillStyle = "#ff5544";
    ctx.fillRect(64, 5, 5, 2.2);

    /* ---------- Textured PMAG (Drops smoothly on reload) ---------- */
    ctx.save();
    ctx.translate(32, 18);
    ctx.rotate(0.14 + rt * 0.65);
    const magDropY = rt * 52;
    metal(-10, magDropY, 22, 38, "#2d353e", "#1e242b", 3);
    // Magazine ribs & grip texture
    ctx.fillStyle = "#161b20";
    for (let my = 6; my < 30; my += 6) {
      ctx.fillRect(-10, my + magDropY, 22, 2);
    }
    // Ammo capacity window with visible brass bullets
    ctx.fillStyle = "#0e1115";
    ctx.fillRect(-4, 10 + magDropY, 10, 16);
    ctx.fillStyle = "#d8a437";
    ctx.fillRect(-2, 12 + magDropY, 6, 4);
    ctx.fillRect(-2, 18 + magDropY, 6, 4);
    // Magazine baseplate
    ctx.fillStyle = "#14181e";
    ctx.fillRect(-11, 34 + magDropY, 24, 6);
    ctx.restore();

    /* ---------- Ergonomic Tactical Pistol Grip ---------- */
    ctx.save();
    ctx.translate(72, 15);
    ctx.rotate(-0.22);
    metal(-8, 0, 17, 34, "#293038", "#1a1f25", 4);
    ctx.fillStyle = "#12161b";
    for (let gy = 6; gy < 28; gy += 5) ctx.fillRect(-8, gy, 17, 2);
    ctx.restore();

    /* ---------- Free-Float M-LOK Handguard & Stainless Heavy Barrel ---------- */
    const hgEnd = -76;
    // Handguard 3D outer body
    this.trapMetal(ctx, hgEnd, 4, -1, 8.5, 12, "#3b4550", "#242a32");
    // Top picatinny rail on handguard
    ctx.fillStyle = "#171c22";
    for (let x = hgEnd + 4; x < 0; x += 7) {
      ctx.fillRect(x, -13, 4.5, 3);
    }
    // M-LOK oblong cooling slots exposing the stainless heavy barrel inside
    for (let x = hgEnd + 8; x < -8; x += 15) {
      ctx.fillStyle = "#0c0f12";
      ctx.beginPath();
      ctx.roundRect(x, -6, 9, 3.2, 1.5);
      ctx.roundRect(x, 2.5, 9, 3.2, 1.5);
      ctx.fill();
      // Stainless steel barrel gleam inside the slots
      ctx.fillStyle = "rgba(180,195,210,0.45)";
      ctx.fillRect(x + 1, -5, 7, 1.2);
      ctx.fillRect(x + 1, 3.5, 7, 1.2);
    }

    /* ---------- Fluted Heavy Match Barrel & Multi-Port Muzzle Brake ---------- */
    // Receding heavy barrel from handguard to muzzle tip
    this.trapMetal(ctx, -bl + 18, hgEnd, -0.5, 3.2, 5.2, "#4a5562", "#2b333c");
    // Gas block & front flip-up sight base
    ctx.fillStyle = "#283038";
    ctx.fillRect(-bl + 48, -8, 8, 14);
    ctx.fillRect(-bl + 50, -14, 3.5, 7);

    // Tactical Multi-Port Compensator / Muzzle Brake at the very tip (-bl)
    this.trapMetal(ctx, -bl, -bl + 18, -0.5, 5.5, 7.2, "#4a5562", "#242a32");
    ctx.fillStyle = "#090b0e";
    ctx.fillRect(-bl + 3, -7, 2.5, 13);
    ctx.fillRect(-bl + 8, -7, 2.5, 13);
    ctx.fillRect(-bl + 13, -7, 2.5, 13);

    /* ---------- Tactical Combat Operator Gloves ---------- */
    // Support hand holding M-LOK handguard from below
    this.drawGlove(ctx, -40, 10, -0.15, 22, true);
    // Firing hand gripping pistol grip
    this.drawGlove(ctx, 64, 25, 0.45, 24, false);
  }

  /* Photorealistic Tactical Submachine Gun (SCORPION PDW) */
  private drawSmgParts(ctx: CanvasRenderingContext2D, rt: number, bl: number) {
    const metal = (x: number, y: number, w: number, h: number, c1: string, c2: string, bevel = 2) => {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, c1);
      g.addColorStop(0.45, c2);
      g.addColorStop(1, "#0d1014");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, bevel);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, y, w, 1.2);
    };

    /* ---------- Collapsible PDW Wire Stock ---------- */
    ctx.save();
    ctx.translate(76, 0);
    ctx.rotate(0.22);
    ctx.fillStyle = "#1e242b";
    ctx.fillRect(0, -4, 54, 5.5);
    ctx.fillRect(46, -5, 8, 26);
    ctx.fillStyle = "#101418";
    ctx.fillRect(0, 7, 54, 3.5);
    ctx.restore();

    /* ---------- Compact Monolithic Receiver ---------- */
    metal(0, -15, 74, 27, "#3a4450", "#242a32", 3);
    ctx.fillStyle = "#171c22";
    for (let x = 2; x < 72; x += 6) ctx.fillRect(x, -18, 4, 3);
    // Ejection port with 9mm brass casing
    ctx.fillStyle = "#0c0e11";
    ctx.fillRect(24, -9, 20, 9);
    ctx.fillStyle = "#d4a836";
    ctx.fillRect(27, -7, 8, 5);
    // Top charging handle (slides on reload)
    ctx.fillStyle = "#2c343e";
    ctx.fillRect(8 + rt * 16, -21, 13, 5);
    ctx.fillStyle = "#14181d";
    ctx.fillRect(6, -20, 32, 3);

    /* ---------- Micro Reflex Sight (Green Dot Optic) ---------- */
    metal(30, -29, 26, 13, "#252c34", "#181d22", 2);
    ctx.fillStyle = "#0e1115";
    ctx.fillRect(33, -26, 20, 8);
    // High-visibility green optic dot with soft bloom
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(140,245,60,0.95)";
    ctx.beginPath();
    ctx.arc(43, -22, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(140,245,60,0.3)";
    ctx.beginPath();
    ctx.arc(43, -22, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* ---------- Lower Receiver, Grip & Match Trigger ---------- */
    metal(2, 12, 62, 12, "#2b323a", "#1b2026", 2);
    ctx.strokeStyle = "#171c22";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(34, 14);
    ctx.quadraticCurveTo(44, 24, 54, 14);
    ctx.stroke();
    ctx.fillStyle = "#d8a437";
    ctx.fillRect(42, 14, 3, 6);

    /* ---------- Smoky Translucent 40-Round Extended Stick Mag ---------- */
    ctx.save();
    ctx.translate(24, 14);
    ctx.rotate(0.38 + rt * 0.6);
    const magY = rt * 52;
    // Translucent smoky polycarbonate body
    ctx.fillStyle = "rgba(35, 42, 50, 0.9)";
    ctx.beginPath();
    ctx.roundRect(-9, magY, 18, 38, 2);
    ctx.fill();
    ctx.strokeStyle = "#1b2128";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Visible stacked 9mm brass cartridges inside magazine
    ctx.fillStyle = "#d4a836";
    for (let b = 4; b < 32; b += 5.5) {
      ctx.fillRect(-6, b + magY, 12, 3);
    }
    // Heavy polymer baseplate
    ctx.fillStyle = "#12161b";
    ctx.fillRect(-10, 34 + magY, 20, 6);
    ctx.restore();

    /* ---------- Ergonomic Pistol Grip ---------- */
    ctx.save();
    ctx.translate(60, 15);
    ctx.rotate(-0.24);
    metal(-7, 0, 16, 30, "#283038", "#1a1f25", 3);
    ctx.restore();

    /* ---------- Shrouded Barrel & Linear Compensator ---------- */
    const hgEnd = -54;
    this.trapMetal(ctx, hgEnd, 4, -1, 7, 10, "#3b4550", "#242a32");
    // Circular cooling ports
    for (let x = hgEnd + 6; x < -4; x += 11) {
      ctx.fillStyle = "#0c0e11";
      ctx.beginPath();
      ctx.arc(x, -1, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    this.trapMetal(ctx, -bl + 14, hgEnd, -0.5, 3, 4.8, "#4a5562", "#2a323a");
    // Compact linear compensator
    this.trapMetal(ctx, -bl, -bl + 14, -0.5, 5, 6.5, "#4a5562", "#242a32");
    ctx.fillStyle = "#090b0e";
    ctx.fillRect(-bl + 3, -6, 2.5, 11);
    ctx.fillRect(-bl + 8, -6, 2.5, 11);

    /* ---------- Angled Foregrip & Tactical Gloves ---------- */
    ctx.save();
    ctx.translate(-36, 7);
    ctx.rotate(-0.12);
    metal(-6, 0, 12, 22, "#283038", "#181d22", 3);
    ctx.restore();

    // Support hand holding angled foregrip
    this.drawGlove(ctx, -34, 14, 0.05, 21, true);
    // Firing hand
    this.drawGlove(ctx, 54, 24, 0.42, 23, false);
  }

  /* Photorealistic Tactical Combat Shotgun (JUDGE-12) */
  private drawShotgunParts(ctx: CanvasRenderingContext2D, rt: number, bl: number) {
    const metal = (x: number, y: number, w: number, h: number, c1: string, c2: string, bevel = 2) => {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, c1);
      g.addColorStop(0.45, c2);
      g.addColorStop(1, "#0d1014");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, bevel);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, y, w, 1.2);
    };

    /* ---------- Heavy Synthetic Stock with Pistol Grip ---------- */
    metal(82, -13, 50, 26, "#2c343e", "#1c2128", 4);
    ctx.fillStyle = "#12151a";
    ctx.fillRect(82, -14, 50, 5);
    ctx.fillStyle = "#0a0c0e";
    ctx.fillRect(126, -15, 10, 30); /* thick rubber recoil pad */
    for (let by = -11; by < 13; by += 4) {
      ctx.fillStyle = "#1c2228";
      ctx.fillRect(127, by, 8, 2);
    }

    /* ---------- Heavy Parkerized Receiver ---------- */
    metal(0, -15, 86, 28, "#3e4854", "#242a32", 3);
    // Ejection port showing loaded 12ga shell
    ctx.fillStyle = "#0c0e11";
    ctx.fillRect(26, -10, 28, 12);
    ctx.fillStyle = "#b83226"; /* crimson red shell */
    ctx.fillRect(30, -8, 14, 8);
    ctx.fillStyle = "#d8a437"; /* brass head */
    ctx.fillRect(44, -8, 4, 8);

    /* ---------- Side-Saddle Shell Carrier (4x 12-Gauge Magnum Shells) ---------- */
    ctx.fillStyle = "#171c22";
    ctx.fillRect(4, -7, 22, 18);
    for (let si = 0; si < 3; si++) {
      const sx = 7 + si * 6.5;
      ctx.fillStyle = "#c22f24"; /* red shell casing */
      ctx.fillRect(sx, -5, 5, 14);
      ctx.fillStyle = "#d8a437"; /* shiny brass base */
      ctx.fillRect(sx, 7, 5, 3.5);
    }

    // Trigger guard + safety button
    ctx.strokeStyle = "#171c22";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, 13);
    ctx.quadraticCurveTo(60, 24, 70, 13);
    ctx.stroke();
    ctx.fillStyle = "#0c0e11";
    ctx.fillRect(58, 13, 3, 7);
    ctx.fillStyle = "#b8e63c";
    ctx.beginPath();
    ctx.arc(76, 6, 2.4, 0, Math.PI * 2);
    ctx.fill();

    /* ---------- Heavy Barrel with Perforated Heat Shield ---------- */
    // Top 12ga heavy barrel
    this.trapMetal(ctx, -bl + 14, 2, -6, 3.8, 5.5, "#4a5562", "#2b333c");
    // Perforated heat shield holes along top
    for (let x = -bl + 34; x < -6; x += 12) {
      ctx.fillStyle = "#0c0e11";
      ctx.beginPath();
      ctx.arc(x, -9, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bottom high-capacity tubular magazine
    this.trapMetal(ctx, -bl + 38, -4, 5.5, 3.5, 4.8, "#3c4652", "#242a32");
    // Steel magazine clamp & sling ring
    ctx.fillStyle = "#262e36";
    ctx.fillRect(-bl + 34, -2, 7, 14);

    // Glowing Green/Amber Fiber-Optic Front Sight Bead
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,180,40,0.98)";
    ctx.beginPath();
    ctx.arc(-bl + 6, -13, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,180,40,0.35)";
    ctx.beginPath();
    ctx.arc(-bl + 6, -13, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Breaching crown standoff muzzle brake at tip
    metal(-bl, -11, 14, 12, "#4a5562", "#242a32", 1);
    ctx.fillStyle = "#090b0e";
    ctx.fillRect(-bl, -11, 3.5, 12);
    ctx.fillRect(-bl + 6, -11, 2.5, 12);

    /* ---------- Grooved Combat Pump Handle (Racks on reload) ---------- */
    const px = rt * 34;
    ctx.save();
    ctx.translate(px, 0);
    metal(-114, -6, 50, 23, "#283038", "#181d22", 3);
    ctx.fillStyle = "#121519"; /* aggressive grip ribs */
    for (let gx = -106; gx < -68; gx += 7) {
      ctx.fillRect(gx, -3, 3.5, 17);
    }
    ctx.restore();
    // Steel action bars
    ctx.fillStyle = "#323b45";
    ctx.fillRect(-64 + px, -3, 66, 3.5);
    ctx.fillRect(-64 + px, 6, 66, 3.5);

    /* ---------- Operator Combat Gloves ---------- */
    // Pump support hand
    this.drawGlove(ctx, -86 + px, 9, -0.1, 24, true);
    // Rear grip hand
    this.drawGlove(ctx, 68, 24, 0.44, 25, false);
  }

  /* ---------------------------- minimap ---------------------------- */

  private renderMinimap() {
    if (this.mode !== "play") return;
    const m = this.mctx;
    const S = 6;
    const arena = ARENAS[this.arenaId] ?? ARENAS.sector7;
    if (!this.miniWalls) {
      const c = document.createElement("canvas");
      c.width = MW * S;
      c.height = MH * S;
      const g = c.getContext("2d")!;
      g.fillStyle = arena.colors.minimapBg;
      g.fillRect(0, 0, c.width, c.height);
      for (let y = 0; y < MH; y++) {
        for (let x = 0; x < MW; x++) {
          const cell = this.grid[y * MW + x];
          if (cell > 0) {
            g.fillStyle =
              cell === 4
                ? "#8a6a24"
                : cell === 5
                ? arena.theme === "cybernexus"
                  ? "#00e5ff"
                  : arena.theme === "bunker"
                  ? "#ef4444"
                  : "#2c6b46"
                : arena.theme === "cybernexus"
                ? "#1e293b"
                : arena.theme === "bunker"
                ? "#5c483a"
                : "#3d4a40";
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
      m.fillStyle = pk.kind === "medkit" ? "#7dff8a" : pk.kind === "armor" ? "#00d4ff" : "#ffb02e";
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
