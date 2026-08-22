# 🎯 BLACKOUT PROTOCOL — Raycast FPS Arena Game

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **BLACKOUT PROTOCOL** is a high-octane, retro-modern 2.5D Raycast Arena First-Person Shooter built from scratch on HTML5 Canvas. Eliminate hostile waves, master 3 tactical weapons, manage emergency medkits, and survive the blackout.

---

## 🎮 Live Demo & Deployment

Deployable with **zero backend dependencies** on [Vercel](https://vercel.com/):
- 100% Client-Side Engine (Canvas 2D Raycasting + Web Audio API).
- High scores and records saved locally via `localStorage`.

---

## ✨ Features

### 🔫 1. Realistic Tactical Weapon Systems
- **PHANTOM MK-IV (Battle Rifle):** Semi-automatic marksman carbine with an EOTech holographic reflex optic, illuminated reticle, M-LOK handguard vents, and competition match trigger.
- **SCORPION PDW (Submachine Gun):** Rapid full-auto personal defense weapon with high-visibility micro red-dot optic and a translucent 40-round magazine showing visible 9mm brass cartridges.
- **JUDGE-12 (Combat Shotgun):** 8-pellet pump-action breacher with a perforated barrel heat shield, side-saddle carrier with 4 magnum shells, glowing fiber-optic sight, and tactile sliding pump reload.
- **Tactical Combat Gloves:** Fully rendered operator arms with carbon-fiber knuckle armor plates and natural weapon-holding perspective.

### 🎯 2. True 3D Hitscan & Ballistics
- **Frustum-Accurate Vertical Aiming:** Fixed raycasting alignment ensuring bullets only hit targets when the crosshair is accurately over their 3D visual silhouette.
- **Sniper Headshot System:** Hitting an enemy's upper 26% registers a critical **HEADSHOT** with 1.9× bonus damage, golden floating indicators, and custom audio stings.

### 🏥 3. Dynamic Supply & Medkit Drops
- **Pre-Spawned Arena Caches:** 4 Medkits scattered in open tactical zones at game launch.
- **Wave Replenishment:** 2–3 new supply drops restocked across strategic nodes per wave.
- **Kill Drops:** Enemies drop Medkits (+40 HP) and Rapid-Fire boosters upon elimination.
- **Emergency Airdrops:** Automatic emergency supply drop triggers when player HP is critical (< 35 HP).

### 🤖 4. Intelligent Hostile AI
- **Grunts:** Tactical riflemen with ranged burst fire and strafing maneuvers.
- **Runners:** Fast, aggressive melee rushers that swarm your position.
- **Heavies:** Armored juggernauts armed with heavy machine guns appearing from Wave 3.

### 🔊 5. Pure Procedural Sound Engine
- 100% synthesized in real-time via the browser's **Web Audio API** — no bulky external sound files.
- Authentic gunfire reports, shell casing clatters, knife slashes, footsteps, and spatial impacts.

### ⚡ 6. Continuous Auto-Depenetration Physics
- Circle-vs-AABB continuous collision solver eliminating corner-snagging, letting the player glide smoothly along walls and around pillars.

---

## ⌨️ Controls & Keybindings

| Key / Action | Function |
| :--- | :--- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> | Move / Strafe |
| `Mouse Movement` | Look / Aim (Pointer Lock enabled) |
| `Left Mouse Button (LMB)` | Fire Weapon |
| `Right Mouse Button (RMB)` / <kbd>Z</kbd> | **Aim Down Sights (ADS) / Zoom Scope** |
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

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## 📦 Deployment to Vercel

The project includes a ready-to-deploy [`vercel.json`](vercel.json) configuration:

```bash
npx vercel
```
Or connect your GitHub repository directly to your [Vercel Dashboard](https://vercel.com/).

---

## 📄 License

This project is licensed under the **MIT License** — feel free to use and modify!
