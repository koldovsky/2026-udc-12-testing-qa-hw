// Test data: rides and riders with varied values.
//
// The values are varied but **deterministic**: the same run must give the same result
// (app/AGENTS.md, rule 7). Override the seed with TEST_SEED=<number> to get a different
// data set; tests print SEED in their failure message, so any failure can be reproduced
// exactly with the same command.

const BIKES = ["classic", "ebike"];
const IN_ZONE = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"];

// 21.09.2026, 09:00 in Kyiv (06:00Z): rides start during the day.
const DAY_START = Date.UTC(2026, 8, 21, 6, 0);
const MINUTE = 60_000;

export const SEED = Number.parseInt(process.env.TEST_SEED ?? "", 10) || 20260921;

// Linear congruential generator (Numerical Recipes constants): enough spread for test data
// and exactly reproducible from the seed. `state * 1664525` stays below 2^53, so the
// multiplication is exact in a double before the >>> 0 wrap.
let state = SEED >>> 0;
function random() {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state / 2 ** 32;
}

const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (list) => list[Math.floor(random() * list.length)];

export function randomRide(overrides = {}) {
  const pickup = DAY_START + between(0, 600) * MINUTE;
  const minutes = between(5, 89);
  return {
    pickupAt: new Date(pickup).toISOString(),
    returnAt: new Date(pickup + minutes * MINUTE).toISOString(),
    bike: pick(BIKES),
    returnStation: pick(IN_ZONE),
    ...overrides,
  };
}

export function randomRides(count, overrides = {}) {
  return Array.from({ length: count }, () => randomRide(overrides));
}

export function randomRider(overrides = {}) {
  return { id: `rider-${between(1000, 9999)}`, type: "standard", ...overrides };
}
