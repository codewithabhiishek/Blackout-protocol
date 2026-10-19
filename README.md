# 🎯 BLACKOUT PROTOCOL — Raycast FPS Arena Game

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **BLACKOUT PROTOCOL** is a high-octane, retro-modern 2.5D Raycast Arena First-Person Shooter built from scratch on HTML5 Canvas. Select from 3 distinct battlefields, equip ballistic armor plates, zoom with optical sights, and survive endless hostile waves.

---

## 🎮 Live Demo & Deployment

Deployable with **zero backend dependencies** on [Vercel](https://vercel.com/):
- 100% Client-Side Engine (Canvas 2D Raycasting + Web Audio API).
- High scores and records saved locally via `localStorage`.

---

## ✨ Features

### 🛡️ 1. Ballistic Armor Plate System
- **0–100 Armor Points (AP):** Player starts with Kevlar body armor that absorbs **65% of incoming damage** before Health is compromised.
- **Armor Break & Ricochet Audio:** Procedural ceramic crack FX when armor shatters, and high-frequency kevlar deflection clinks.
- **Collectible Armor Plates (+50 AP):** Guaranteed drops from heavy hostile units and scattered across tactical supply nodes.
- **Glowing Cyan Shield Gauge:** Real-time dual-meter vitals HUD showing Health (HP) alongside Armor (AP).

### 🗺️ 2. Multiple Combat Arenas & Map Themes
Select your combat theater directly from the Main Menu:
- **Sector 7 Compound (Industrial Blackout Facility):** Close-quarters corridors, olive military brick, reinforced hazard pillars, and green tech power conduits.
- **Cyber Nexus (Neo-Tokyo Skyline Rooftop):** High-tech carbon fiber plaza, neon cyan light conduits, magenta status indicators, and perimeter sniper monoliths.
- **Bunker 404 (Desert Fortified Outpost):** Weathered sandstone bastions, interlocking blast trenches, heavy iron blast plates, and emergency red conduits.

### 🔫 3. Realistic Tactical Weapon Systems & ADS Scopes
- **PHANTOM MK-IV (Battle Rifle):** Semi-automatic marksman carbine with **2.2× optical zoom scope**, illuminated red reticle, milliradian rangefinder hashes, and match-grade accuracy.
- **SCORPION PDW (Submachine Gun):** Rapid full-auto personal defense weapon with **1.5× green CQB reflex sight** and a translucent 40-round magazine.
- **JUDGE-12 (Combat Shotgun):** Heavy 8-pellet pump-action breacher with an **amber buckshot spread optic** and high close-quarters stopping power.
- **Tactical Combat Gloves:** Fully rendered operator arms with carbon-fiber knuckle armor plates.

### 🎯 4. True 3D Hitscan & Ballistics
- **Frustum-Accurate Vertical Aiming:** Fixed raycasting alignment ensuring bullets only hit targets when the crosshair is accurately over their 3D visual silhouette.
- **Sniper Headshot System:** Hitting an enemy's upper 24% registers a critical **HEADSHOT** with 1.9× bonus damage, golden floating indicators, and custom audio stings.

### 🏥 5. Dynamic Supply & Medkit Drops
- **Pre-Spawned Arena Caches:** Medkits (+40 HP) and Armor Plates (+50 AP) scattered in open tactical zones at game launch.
- **Wave Replenishment:** 2–3 new supply drops restocked across strategic nodes per wave.
- **Emergency Airdrops:** Automatic emergency supply drop triggers when player HP is critical (< 35 HP).

### 🤖 6. Intelligent Hostile AI
- **Grunts:** Tactical riflemen with ranged burst fire and strafing maneuvers.
- **Runners:** Fast, aggressive melee rushers that swarm your position.
- **Heavies:** Armored juggernauts armed with heavy machine guns that drop guaranteed Armor Plates.

### 🔊 7. Pure Procedural Sound Engine
- 100% synthesized in real-time via the browser's **Web Audio API** — no bulky external sound files.

---

## ⌨️ Controls & Keybindings

| Key / Action | Function |
| :--- | :--- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> | Move / Strafe |
| `Mouse Movement` | Look / Aim (Pointer Lock enabled) |
| `Left Mouse Button (LMB)` | Fire Weapon |
| `Right Mouse Button (RMB)` / <kbd>Z</kbd> | **Aim Down Sights (ADS) / Optical Zoom Scope** |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> / <kbd>Q</kbd> / `Scroll Wheel` | Switch Weapons (Rifle / SMG / Shotgun) |
| <kbd>R</kbd> | Reload Magazine |
| <kbd>Shift</kbd> | Tactical Sprint |
| <kbd>Space</kbd> | Jump |
| <kbd>C</kbd> / <kbd>Ctrl</kbd> | Crouch (reduces recoil & bullet spread) |
| <kbd>F</kbd> | Maximize Screen / Toggle Fullscreen |
| <kbd>V</kbd> / <kbd>E</kbd> | Tactical Combat Knife Melee |
| <kbd>P</kbd> / <kbd>Esc</kbd> | Pause Combat |
| <kbd>M</kbd> | Toggle Audio Mute |

---

## 🛠️ Tech Stack

- **Frontend Framework:** React 18
- **Language:** TypeScript 5.7
- **Bundler & Dev Server:** Vite 6
- **Styling:** Tailwind CSS v4 + Framer Motion
- **Renderer:** Custom 2.5D Raycasting Engine on HTML5 Canvas 2D
- **Audio:** Web Audio API (Procedural Synthesizer)
- **Deployment:** Vercel (Configured via `vercel.json`)

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn / pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/codewithabhiishek/Blackout-protocol.git
   cd Blackout-protocol
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## 🧪 Testing & Quality Assurance

Blackout Protocol contains an automated test suite executed via Node's native test runner (`node --test`), verifying ballistic armor absorption formulas, armor break penetration, fatal damage thresholds, headshot critical multipliers, score multiplier combos, weapon specifications, arena integrity, and haptic engine safety.

```bash
# Run unit tests (9 tests)
npm test

# Typecheck TypeScript
npm run typecheck

# Production build check
npm run build
```

---

## 🛡️ Security & Engineering Standards

- **0 Dependencies Flaws**: 100% clean `npm audit` with 0 CVE vulnerabilities across production and development dependencies.
- **Client-Side Data Isolation**: Combat records and high scores stay strictly localized in `localStorage` without tracking or telemetry leaks.
- **Mobile Tactile Haptics**: Native vibration engine (`triggerHaptic`) providing tactile feedback on weapon fire, damage taken, armor breakage, and menu navigation.
- **Lightweight Zero-Asset Architecture**: 100% procedural Web Audio sound synthesis and Canvas 2D raycasting without bloated external binary assets.

---

## 👨‍💻 Author & Creator

Designed & engineered by [**Abhishek**](https://abhiishek.is-a.dev/) — explore more projects, games, and experiments at [abhiishek.is-a.dev](https://abhiishek.is-a.dev/).

---

## 📜 License

MIT License &copy; 2026 Blackout Protocol Team.

