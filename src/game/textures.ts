/* All game art is generated procedurally on offscreen canvases — zero image assets. */

export type EnemyKind = "grunt" | "runner" | "heavy";
export type ArenaTheme = "sector7" | "cybernexus" | "bunker";

export interface EnemySprites {
  walk: [HTMLCanvasElement, HTMLCanvasElement];
  hit: HTMLCanvasElement;
}

export const SW = 64;
export const SH = 88;

function cv(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* WALLS — index 1..5 (0 = dark fallback) per arena theme             */
/* ------------------------------------------------------------------ */

export function makeWallTextures(theme: ArenaTheme = "sector7"): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];

  /* 0 — fallback */
  {
    const c = cv(64, 64);
    const g = c.getContext("2d")!;
    g.fillStyle = theme === "bunker" ? "#2b2319" : theme === "cybernexus" ? "#080c14" : "#1a1f1c";
    g.fillRect(0, 0, 64, 64);
    out.push(c);
  }

  if (theme === "cybernexus") {
    /* 1 — Dark Carbon with Neon Cyan Slits */
    {
      const c = cv(64, 64);
      const g = c.getContext("2d")!;
      g.fillStyle = "#0c1017";
      g.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += 4) {
        for (let y = 0; y < 64; y += 4) {
          g.fillStyle = (x + y) % 8 === 0 ? "#151b24" : "#0f141c";
          g.fillRect(x, y, 3.5, 3.5);
        }
      }
      g.fillStyle = "rgba(0, 220, 255, 0.75)";
      g.shadowColor = "#00dcff";
      g.shadowBlur = 6;
      g.fillRect(30, 4, 3, 56);
      g.shadowBlur = 0;
      out.push(c);
    }
    /* 2 — Matte Black Composite with Magenta Status Indicators */
    {
      const c = cv(64, 64);
      const g = c.getContext("2d")!;
      g.fillStyle = "#12131a";
      g.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += 16) {
        g.fillStyle = "#1b1d28";
        g.fillRect(x, 0, 2, 64);
        g.fillStyle = "#08090d";
        g.fillRect(x + 2, 0, 1, 64);
      }
      g.fillStyle = "rgba(220, 40, 255, 0.85)";
      g.shadowColor = "#dc28ff";
      g.shadowBlur = 5;
      g.fillRect(10, 24, 12, 3);
      g.fillRect(42, 24, 12, 3);
      g.shadowBlur = 0;
      out.push(c);
    }
    /* 3 — Translucent Holographic Grid */
    {
      const c = cv(64, 64);
      const g = c.getContext("2d")!;
      g.fillStyle = "#0a1322";
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = "rgba(0, 190, 255, 0.18)";
      g.lineWidth = 1;
      for (let i = 0; i <= 64; i += 8) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
      }
      g.fillStyle = "rgba(0, 240, 255, 0.65)";
      g.fillRect(20, 20, 24, 24);
      g.fillStyle = "#0a1322";
      g.fillRect(22, 22, 20, 20);
      out.push(c);
    }
    /* 4 — Electric Cyan / Black Caution Stripes */
    {
      const c = cv(64, 64);
      const g = c.getContext("2d")!;
      g.fillStyle = "#080e14";
      g.fillRect(0, 0, 64, 64);
      g.save();
      g.beginPath(); g.rect(0, 6, 64, 52); g.clip();
      g.translate(32, 32); g.rotate(-Math.PI / 4);
      for (let x = -100; x < 100; x += 18) {
        g.fillStyle = (x / 18) % 2 === 0 ? "#00e5ff" : "#0b121a";
        g.fillRect(x, -80, 9, 160);
      }
      g.restore();
      out.push(c);
    }
    /* 5 — Glowing Neon Cyber Conduit */
    {
      const c = cv(64, 64);
      const g = c.getContext("2d")!;
      g.fillStyle = "#080c14";
      g.fillRect(0, 0, 64, 64);
      g.shadowColor = "#00ffff";
      g.shadowBlur = 8;
      g.strokeStyle = "rgba(0, 255, 255, 0.85)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(8, 0); g.lineTo(8, 24); g.lineTo(32, 24); g.lineTo(32, 48); g.lineTo(56, 48); g.lineTo(56, 64);
      g.stroke();
      g.fillStyle = "#ffffff";
      g.fillRect(30, 22, 4, 4);
      g.shadowBlur = 0;
      out.push(c);
    }
    return out;
  }

  if (theme === "bunker") {
    /* 1 — Desert Weathered Sandstone */
    {
      const c = cv(64, 64);
      const g = c.getContext("2d")!;
      const r = rng(201);
      g.fillStyle = "#4a3c2c";
      g.fillRect(0, 0, 64, 64);
      const shades = ["#8a7152", "#7d6749", "#947b59", "#705c41", "#846b4d"];
      for (let row = 0; row < 8; row++) {
        const off = row % 2 === 0 ? 0 : 8;
        for (let col = -1; col < 5; col++) {
          g.fillStyle = shades[Math.floor(r() * shades.length)];
          g.fillRect(col * 16 + off + 1, row * 8 + 1, 14, 6);
          g.fillStyle = "rgba(255,230,190,0.06)";
          g.fillRect(col * 16 + off + 1, row * 8 + 1, 14, 1);
        }
      }
      out.push(c);
    }
    /* 2 — Rusted Iron Bunker Plates */
    {
      const c = cv(64, 64);
      const g = c.getContext("2d")!;
      const r = rng(202);
      g.fillStyle = "#3d2d24";
      g.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += 16) {
        g.fillStyle = "#2b1e17";
        g.fillRect(x, 0, 2, 64);
        g.fillStyle = "rgba(200,100,50,0.18)";
        g.fillRect(x + 2, 0, 3, 64);
      }
      for (let x = 5; x < 64; x += 16) {
        for (const y of [6, 22, 42, 58]) {
          g.fillStyle = "#5c483a";
          g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill();
        }
      }
      out.push(c);
    }
    /* 3 — Fortified Blast Concrete */
    {
      const c = cv(64, 64);
      const g = c.getContext("2d")!;
      const r = rng(203);
      g.fillStyle = "#47413b";
      g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 7; i++) {
        const x = r() * 64, y = r() * 64, rad = 8 + r() * 14;
        const gr = g.createRadialGradient(x, y, 1, x, y, rad);
        gr.addColorStop(0, "rgba(35,28,22,0.45)");
        gr.addColorStop(1, "rgba(35,28,22,0)");
        g.fillStyle = gr;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      out.push(c);
    }
    /* 4 — Desert Blast Hazard Stripes */
    {
      const c = cv(64, 64);
      const g = c.getContext("2d")!;
      g.fillStyle = "#362c22";
      g.fillRect(0, 0, 64, 64);
      g.save();
      g.beginPath(); g.rect(0, 6, 64, 52); g.clip();
      g.translate(32, 32); g.rotate(-Math.PI / 4);
      for (let x = -100; x < 100; x += 18) {
        g.fillStyle = (x / 18) % 2 === 0 ? "#e09028" : "#1f1710";
        g.fillRect(x, -80, 9, 160);
      }
      g.restore();
      out.push(c);
    }
    /* 5 — Emergency Red Conduit */
    {
      const c = cv(64, 64);
      const g = c.getContext("2d")!;
      g.fillStyle = "#211410";
      g.fillRect(0, 0, 64, 64);
      g.shadowColor = "#ff3b20";
      g.shadowBlur = 6;
      g.strokeStyle = "rgba(255, 60, 40, 0.85)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 32); g.lineTo(64, 32);
      g.stroke();
      g.shadowBlur = 0;
      out.push(c);
    }
    return out;
  }

  /* Default — Sector 7 Compound */
  /* 1 — olive brick */
  {
    const c = cv(64, 64);
    const g = c.getContext("2d")!;
    const r = rng(11);
    g.fillStyle = "#171a13";
    g.fillRect(0, 0, 64, 64);
    const shades = ["#2b3126", "#293024", "#2e352a", "#272d22", "#2c332b"];
    for (let row = 0; row < 8; row++) {
      const off = row % 2 === 0 ? 0 : 8;
      for (let col = -1; col < 5; col++) {
        g.fillStyle = shades[Math.floor(r() * shades.length)];
        g.fillRect(col * 16 + off + 1, row * 8 + 1, 14, 6);
        g.fillStyle = "rgba(255,255,255,0.045)";
        g.fillRect(col * 16 + off + 1, row * 8 + 1, 14, 1);
      }
    }
    for (let i = 0; i < 260; i++) {
      g.fillStyle = r() > 0.5 ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.03)";
      g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 1);
    }
    out.push(c);
  }

  /* 2 — riveted gunmetal panels */
  {
    const c = cv(64, 64);
    const g = c.getContext("2d")!;
    const r = rng(23);
    g.fillStyle = "#262b31";
    g.fillRect(0, 0, 64, 64);
    for (let x = 0; x < 64; x += 16) {
      g.fillStyle = "#1a1e23";
      g.fillRect(x, 0, 2, 64);
      g.fillStyle = "rgba(255,255,255,0.05)";
      g.fillRect(x + 2, 0, 1, 64);
    }
    for (let y = 0; y < 64; y += 2) {
      g.fillStyle = "rgba(255,255,255,0.014)";
      g.fillRect(0, y, 64, 1);
    }
    g.fillStyle = "#1f242a";
    g.fillRect(0, 28, 64, 7);
    g.fillStyle = "#8a6a24";
    g.fillRect(26, 30, 12, 3);
    for (let x = 5; x < 64; x += 16) {
      for (const y of [6, 22, 42, 58]) {
        g.fillStyle = "#3d4650";
        g.beginPath();
        g.arc(x, y, 1.8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#12161a";
        g.beginPath();
        g.arc(x, y, 0.8, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (let i = 0; i < 200; i++) {
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 1);
    }
    out.push(c);
  }

  /* 3 — stained concrete */
  {
    const c = cv(64, 64);
    const g = c.getContext("2d")!;
    const r = rng(37);
    g.fillStyle = "#31353a";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 9; i++) {
      const x = r() * 64, y = r() * 64, rad = 6 + r() * 16;
      const gr = g.createRadialGradient(x, y, 1, x, y, rad);
      gr.addColorStop(0, "rgba(21,23,26,0.32)");
      gr.addColorStop(1, "rgba(21,23,26,0)");
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = "rgba(14,16,18,0.85)";
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      let x = r() * 64, y = 0;
      g.moveTo(x, y);
      while (y < 64) {
        x += (r() - 0.5) * 12;
        y += 6 + r() * 10;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 240; i++) {
      g.fillStyle = r() > 0.6 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.2)";
      g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 1);
    }
    out.push(c);
  }

  /* 4 — hazard stripes */
  {
    const c = cv(64, 64);
    const g = c.getContext("2d")!;
    const r = rng(41);
    g.fillStyle = "#23272c";
    g.fillRect(0, 0, 64, 64);
    g.save();
    g.beginPath();
    g.rect(0, 6, 64, 52);
    g.clip();
    g.translate(32, 32);
    g.rotate(-Math.PI / 4);
    for (let x = -100; x < 100; x += 18) {
      g.fillStyle = (x / 18) % 2 === 0 ? "#d99b26" : "#141518";
      g.fillRect(x, -80, 9, 160);
    }
    g.restore();
    g.fillStyle = "#1a1e23";
    g.fillRect(0, 4, 64, 2);
    g.fillRect(0, 58, 64, 2);
    for (let x = 4; x < 64; x += 12) {
      for (const y of [2, 61]) {
        g.fillStyle = "#454e58";
        g.beginPath();
        g.arc(x, y, 1.4, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 1);
    }
    out.push(c);
  }

  /* 5 — glowing tech conduit */
  {
    const c = cv(64, 64);
    const g = c.getContext("2d")!;
    const r = rng(53);
    g.fillStyle = "#0c1310";
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "rgba(57,255,140,0.06)";
    g.lineWidth = 1;
    for (let i = 0; i <= 64; i += 8) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
    }
    g.shadowColor = "#39ff8c";
    g.shadowBlur = 4;
    g.strokeStyle = "rgba(57,255,140,0.55)";
    for (let i = 0; i < 6; i++) {
      let x = Math.floor(r() * 8) * 8;
      let y = Math.floor(r() * 8) * 8;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 3; s++) {
        if (r() > 0.5) x = Math.min(64, x + (Math.floor(r() * 3) + 1) * 8);
        else y = Math.min(64, y + (Math.floor(r() * 3) + 1) * 8);
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = "rgba(140,255,190,0.9)";
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    g.shadowBlur = 0;
    g.fillStyle = "rgba(57,255,140,0.14)";
    g.fillRect(26, 26, 12, 12);
    g.strokeStyle = "rgba(57,255,140,0.5)";
    g.strokeRect(26.5, 26.5, 11, 11);
    for (let y = 0; y < 64; y += 3) {
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(0, y, 64, 1);
    }
    out.push(c);
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* ENEMY SOLDIER SPRITES                                               */
/* ------------------------------------------------------------------ */

const KIND_STYLE: Record<
  EnemyKind,
  { armor: string; dark: string; trim: string; eyes: string; wf: number }
> = {
  grunt: { armor: "#4a5d3a", dark: "#31402a", trim: "#6b7f52", eyes: "#d8ff3c", wf: 1 },
  runner: { armor: "#5c2530", dark: "#3d1a22", trim: "#8a3a47", eyes: "#ff3b30", wf: 0.88 },
  heavy: { armor: "#6e4a1e", dark: "#4a3214", trim: "#96682e", eyes: "#ff9f1c", wf: 1.18 },
};

function drawSoldier(kind: EnemyKind, frame: number): HTMLCanvasElement {
  const c = cv(SW, SH);
  const g = c.getContext("2d")!;
  const st = KIND_STYLE[kind];
  const wf = st.wf;
  const cx = 32;
  const step = frame === 0 ? 1 : -1;

  /* shadow */
  g.fillStyle = "rgba(0,0,0,0.42)";
  g.beginPath();
  g.ellipse(cx, 84, 15 * wf, 3.6, 0, 0, Math.PI * 2);
  g.fill();

  /* legs */
  g.fillStyle = st.dark;
  g.fillRect(cx - 11 * wf + step * 1.5, 52, 9 * wf, 27 + step * 2);
  g.fillRect(cx + 2 * wf - step * 1.5, 52, 9 * wf, 27 - step * 2);
  g.fillStyle = "#14171a";
  g.fillRect(cx - 12 * wf + step * 1.5, 76 + step * 2, 11 * wf, 5);
  g.fillRect(cx + 1 * wf - step * 1.5, 76 - step * 2, 11 * wf, 5);

  /* torso */
  g.fillStyle = st.armor;
  g.fillRect(cx - 14 * wf, 27, 28 * wf, 27);
  g.fillStyle = st.trim;
  g.fillRect(cx - 14 * wf, 27, 28 * wf, 5);
  g.fillStyle = "rgba(255,255,255,0.10)";
  g.fillRect(cx - 14 * wf, 27, 3, 27);
  g.fillStyle = st.dark;
  g.fillRect(cx - 14 * wf, 50, 28 * wf, 4);
  g.fillStyle = "#1c2117";
  g.fillRect(cx - 9 * wf, 36, 6, 7);
  g.fillRect(cx + 3 * wf, 36, 6, 7);

  /* shoulder pads (heavy) / straps (grunt) */
  if (kind === "heavy") {
    g.fillStyle = st.trim;
    g.fillRect(cx - 21 * wf, 26, 9, 10);
    g.fillRect(cx + 12 * wf, 26, 9, 10);
    g.fillStyle = "#14171a";
    g.fillRect(cx - 21 * wf, 33, 9, 2);
    g.fillRect(cx + 12 * wf, 33, 9, 2);
  } else {
    g.fillStyle = st.dark;
    g.fillRect(cx - 16 * wf, 28, 4, 14);
    g.fillRect(cx + 12 * wf, 28, 4, 14);
  }

  /* rifle across body, muzzle to the left */
  g.fillStyle = "#14161a";
  g.fillRect(cx - 27 * wf, 40, 38 * wf, 5);
  g.fillRect(cx - 30 * wf, 41, 4, 3);
  g.fillStyle = "#23272e";
  g.fillRect(cx - 8 * wf, 38, 12 * wf, 3);
  /* hands */
  g.fillStyle = "#1e2228";
  g.beginPath();
  g.arc(cx - 15 * wf, 43, 4, 0, Math.PI * 2);
  g.arc(cx + 5 * wf, 44, 4, 0, Math.PI * 2);
  g.fill();

  /* head */
  g.fillStyle = st.dark;
  g.fillRect(cx - 9 * wf, 8, 18 * wf, 18);
  g.fillStyle = st.armor;
  g.fillRect(cx - 9 * wf, 8, 18 * wf, 5);
  g.fillStyle = "#0b0d0f";
  g.fillRect(cx - 8 * wf, 15, 16 * wf, 7);
  /* glowing eyes */
  g.shadowColor = st.eyes;
  g.shadowBlur = 6;
  g.fillStyle = st.eyes;
  g.fillRect(cx - 6 * wf, 17, 3.4, 3);
  g.fillRect(cx + 2.4 * wf, 17, 3.4, 3);
  g.shadowBlur = 0;

  if (kind === "grunt") {
    g.strokeStyle = st.trim;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(cx + 8 * wf, 9);
    g.lineTo(cx + 12 * wf, 2);
    g.stroke();
    g.fillStyle = st.eyes;
    g.fillRect(cx + 11, 1, 2, 2);
  }
  if (kind === "runner") {
    g.fillStyle = st.dark;
    g.beginPath();
    g.moveTo(cx - 10 * wf, 12);
    g.lineTo(cx, 4);
    g.lineTo(cx + 10 * wf, 12);
    g.closePath();
    g.fill();
    g.fillStyle = st.trim;
    g.fillRect(cx - 8 * wf, 24, 16 * wf, 3);
  }

  return c;
}

function whiteVariant(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = cv(src.width, src.height);
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function makeEnemySprites(): Record<EnemyKind, EnemySprites> {
  const out = {} as Record<EnemyKind, EnemySprites>;
  (["grunt", "runner", "heavy"] as EnemyKind[]).forEach((k) => {
    const w0 = drawSoldier(k, 0);
    const w1 = drawSoldier(k, 1);
    out[k] = { walk: [w0, w1], hit: whiteVariant(w0) };
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* PICKUPS — Medkit (+40 HP), Rapid Fire, Armor Plate (+50 AP)        */
/* ------------------------------------------------------------------ */

export function makePickupSprites(): Record<"medkit" | "rapid" | "armor", HTMLCanvasElement> {
  const med = cv(36, 36);
  {
    const g = med.getContext("2d")!;
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.ellipse(18, 32, 13, 3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#d8dde2";
    g.fillRect(5, 8, 26, 22);
    g.fillStyle = "#aeb6bd";
    g.fillRect(5, 25, 26, 5);
    g.fillStyle = "#8f989f";
    g.fillRect(5, 8, 26, 2);
    g.fillStyle = "#d43a2f";
    g.fillRect(15, 12, 6, 14);
    g.fillRect(11, 16, 14, 6);
    g.strokeStyle = "#14171a";
    g.lineWidth = 1.5;
    g.strokeRect(5, 8, 26, 22);
  }

  const rap = cv(36, 36);
  {
    const g = rap.getContext("2d")!;
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.ellipse(18, 32, 13, 3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#23272e";
    g.fillRect(5, 8, 26, 22);
    g.strokeStyle = "#ffb02e";
    g.lineWidth = 2;
    g.strokeRect(6, 9, 24, 20);
    g.fillStyle = "#ffb02e";
    g.beginPath();
    g.moveTo(21, 11);
    g.lineTo(12, 20);
    g.lineTo(17, 20);
    g.lineTo(14, 28);
    g.lineTo(24, 18);
    g.lineTo(19, 18);
    g.lineTo(22, 11);
    g.closePath();
    g.fill();
  }

  const arm = cv(36, 36);
  {
    const g = arm.getContext("2d")!;
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.ellipse(18, 32, 13, 3, 0, 0, Math.PI * 2);
    g.fill();
    /* Kevlar Plate Body */
    g.fillStyle = "#121b24";
    g.fillRect(6, 7, 24, 23);
    g.fillStyle = "#1e2c3a";
    g.fillRect(7, 8, 22, 21);
    /* Cyan Tactical Shield Crest */
    g.strokeStyle = "#00d4ff";
    g.lineWidth = 2;
    g.strokeRect(6, 7, 24, 23);
    g.fillStyle = "#00d4ff";
    g.beginPath();
    g.moveTo(18, 12);
    g.lineTo(25, 15);
    g.lineTo(25, 21);
    g.lineTo(18, 26);
    g.lineTo(11, 21);
    g.lineTo(11, 15);
    g.closePath();
    g.fill();
    g.fillStyle = "#091219";
    g.fillRect(16, 17, 4, 4);
  }

  return { medkit: med, rapid: rap, armor: arm };
}
