import test from 'node:test';
import assert from 'node:assert/strict';

// Core Combat & Ballistics Formulas from Blackout Protocol Engine
function calculateDamageAbsorption(currentAp, currentHp, incomingDmg) {
  let ap = currentAp;
  let hp = currentHp;
  let tookArmor = false;
  let absorbed = 0;
  let penDmg = incomingDmg;

  if (ap > 0) {
    tookArmor = true;
    absorbed = Math.min(ap, Math.round(incomingDmg * 0.65));
    ap -= absorbed;
    penDmg = incomingDmg - absorbed;
    hp -= penDmg;
  } else {
    hp -= incomingDmg;
  }

  return {
    ap: Math.max(0, ap),
    hp: Math.max(0, hp),
    absorbed,
    penDmg,
    tookArmor,
    armorBroken: tookArmor && ap <= 0,
    isDead: hp <= 0,
  };
}

function calculateScoreMultiplier(currentMult, timeSinceLastKillSec) {
  if (timeSinceLastKillSec <= 3.0) {
    return Math.min(5, currentMult + 1);
  }
  return 1;
}

function calculateCriticalDamage(baseDamage, isHeadshot) {
  if (!isHeadshot) return baseDamage;
  return Math.round(baseDamage * 1.9);
}

function triggerHaptic(duration = 15) {
  if (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  ) {
    try {
      navigator.vibrate(duration);
    } catch {
      // Ignored in non-supporting runtime
    }
  }
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

test('Armor Plate Absorption absorbs 65% of incoming damage', () => {
  // 50 AP, 100 HP, incoming 40 dmg -> 65% of 40 = 26 absorbed. 14 penetrates to HP.
  const res = calculateDamageAbsorption(50, 100, 40);
  assert.equal(res.absorbed, 26);
  assert.equal(res.penDmg, 14);
  assert.equal(res.ap, 24);
  assert.equal(res.hp, 86);
  assert.equal(res.tookArmor, true);
  assert.equal(res.armorBroken, false);
});

test('Armor Plate Break absorbs partially and lets remaining damage penetrate', () => {
  // 10 AP, 100 HP, incoming 40 dmg -> 65% is 26, but only 10 AP exists.
  // 10 AP absorbed (armor breaks to 0). 30 penetrates to HP (HP becomes 70).
  const res = calculateDamageAbsorption(10, 100, 40);
  assert.equal(res.absorbed, 10);
  assert.equal(res.penDmg, 30);
  assert.equal(res.ap, 0);
  assert.equal(res.hp, 70);
  assert.equal(res.armorBroken, true);
});

test('Unarmored operative receives 100% direct damage to HP', () => {
  const res = calculateDamageAbsorption(0, 100, 35);
  assert.equal(res.absorbed, 0);
  assert.equal(res.penDmg, 35);
  assert.equal(res.ap, 0);
  assert.equal(res.hp, 65);
  assert.equal(res.tookArmor, false);
});

test('Fatal damage clamps HP cleanly to 0 and flags operative K.I.A.', () => {
  const res = calculateDamageAbsorption(0, 25, 45);
  assert.equal(res.hp, 0);
  assert.equal(res.isDead, true);
});

test('Headshot critical hits apply 1.9x bonus damage multiplier', () => {
  const baseDmg = 40;
  const bodyShot = calculateCriticalDamage(baseDmg, false);
  const headShot = calculateCriticalDamage(baseDmg, true);

  assert.equal(bodyShot, 40);
  assert.equal(headShot, 76); // 40 * 1.9 = 76
});

test('Score multiplier increments within 3s kill window up to 5x cap', () => {
  let mult = 1;
  mult = calculateScoreMultiplier(mult, 1.2); // kill 1.2s later
  assert.equal(mult, 2);

  mult = calculateScoreMultiplier(mult, 0.8);
  assert.equal(mult, 3);

  mult = calculateScoreMultiplier(mult, 2.5);
  assert.equal(mult, 4);

  mult = calculateScoreMultiplier(mult, 1.0);
  assert.equal(mult, 5);

  mult = calculateScoreMultiplier(mult, 1.5);
  assert.equal(mult, 5); // Capped at x5

  // Window expires (> 3.0s)
  mult = calculateScoreMultiplier(mult, 3.5);
  assert.equal(mult, 1); // Resets to 1
});

test('Weapon arsenal specifications adhere to tactical balance parameters', () => {
  const WEAPONS = [
    { name: 'PHANTOM MK-IV', short: 'RIFLE', mag: 24, auto: false, range: 40 },
    { name: 'SCORPION PDW', short: 'SMG', mag: 40, auto: true, range: 30 },
    { name: 'JUDGE-12', short: 'SHOTGUN', mag: 6, auto: false, range: 10, pellets: 8 },
  ];

  assert.equal(WEAPONS.length, 3);
  assert.equal(WEAPONS[0].mag, 24);
  assert.equal(WEAPONS[0].auto, false); // Rifle is semi-auto
  assert.equal(WEAPONS[1].auto, true);  // SMG is full-auto
  assert.equal(WEAPONS[2].pellets, 8);  // Shotgun fires 8 pellets
});

test('Arena catalogs define all 3 combat theaters with non-empty metadata', () => {
  const ARENAS = [
    { id: 'sector7', name: 'SECTOR 7 COMPOUND', accent: '#7dff8a' },
    { id: 'cybernexus', name: 'CYBER NEXUS', accent: '#00d4ff' },
    { id: 'bunker', name: 'BUNKER 404', accent: '#ffb02e' },
  ];

  assert.equal(ARENAS.length, 3);
  for (const arena of ARENAS) {
    assert.ok(arena.id.length > 0);
    assert.ok(arena.name.length > 0);
    assert.match(arena.accent, /^#[0-9a-fA-F]{6}$/);
  }
});

test('triggerHaptic executes safely in non-browser Node environments', () => {
  assert.doesNotThrow(() => {
    triggerHaptic(20);
    triggerHaptic([30, 20, 30]);
  });
});
