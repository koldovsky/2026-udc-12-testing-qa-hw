// Task D, the flaky receipt test: where does its old oracle disagree with the code, and how often
// does that happen? Run from the repo root: node docs/evidence/d-flaky-oracle.mjs
// The old oracle and loop are copied from app/test/integration/receipt.test.js:11-24 at b8c42be.
import { quote } from "../../app/src/tariff.js";
import { formatReceipt } from "../../app/src/receipt.js";
import { randomRider, randomRides } from "../../app/test/helpers/factory.js";

const PRICE = { classic: 2500, ebike: 4000 };
const uah = (k) => `${(k / 100).toFixed(2).replace(".", ",")} грн`;
const oldOracle = (minutes, bike) => (Math.floor(minutes / 30) + 1) * PRICE[bike];
const agrees = (ride, rider) => {
  const minutes = (Date.parse(ride.returnAt) - Date.parse(ride.pickupAt)) / 60_000;
  return { minutes, ok: formatReceipt(quote(ride, rider)).at(-1).endsWith(` ${uah(oldOracle(minutes, ride.bike))}`) };
};

// 1. Every ride the factory can produce (app/test/helpers/factory.js:7, :14-15): pickup 06:00Z + 0…600 min,
//    5…89 min, both bikes. Station does not matter for the amount (all in zone); S01 is used.
const DAY_START = Date.UTC(2026, 8, 21, 6, 0);
let checked = 0;
const bad = {};
for (const bike of ["classic", "ebike"]) for (let off = 0; off <= 600; off++) for (let m = 5; m <= 89; m++) {
  const p = DAY_START + off * 60_000;
  const ride = { pickupAt: new Date(p).toISOString(), returnAt: new Date(p + m * 60_000).toISOString(), bike, returnStation: "S01" };
  checked++;
  if (!agrees(ride, { type: "standard" }).ok) bad[m] = (bad[m] ?? 0) + 1;
}
console.log(`1. rides checked: ${checked}; old oracle ≠ code at durations (min → rides):`, bad);

// 2. Probability: 2 of 85 durations per ride, 10 rides per run.
const perRun = 1 - (83 / 85) ** 10;
console.log(`2. P(run red) = 1 − (83/85)^10 = ${perRun.toFixed(4)}; in 30 runs ≈ ${(30 * perRun).toFixed(1)}`);

// 3. The old test body N times in one process, with the real random factory.
const N = 100_000;
let red = 0;
const first = {};
for (let i = 0; i < N; i++) {
  const rider = randomRider();
  for (const ride of randomRides(10)) {
    const r = agrees(ride, rider);
    if (!r.ok) { red++; first[r.minutes] = (first[r.minutes] ?? 0) + 1; break; }
  }
}
console.log(`3. simulated runs: ${N}; red: ${red} (${((100 * red) / N).toFixed(2)} %); first failing duration → runs:`, first);
