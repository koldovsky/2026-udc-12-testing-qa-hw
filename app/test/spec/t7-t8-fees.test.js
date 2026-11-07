// docs/test-cases.md TC-41…TC-47 — T7 (return outside the zone), T8 (unreturned bike).
// Expectations: docs/test-cases.md, docs/spec/tariffs.md:109-125 (+ T6 :101, додаток А :164-176).

import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";
import { ride, rider } from "../helpers/spec.js";

const IN_ZONE = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"];

const STATION_CASES = [
  { id: "TC-41", station: "X01", total: 17500 },
  { id: "TC-42", station: "X02", total: 17500 },
  { id: "TC-42", station: "X03", total: 17500 },
  ...IN_ZONE.map((station) => ({ id: "TC-43", station, total: 2500 })),
];

for (const c of STATION_CASES) {
  test(`T7: ${c.id} — 20 хв, станція ${c.station} → до сплати ${c.total}`, () => {
    const result = quote(ride({ minutes: 20, station: c.station }), rider());
    assert.equal(result.total, c.total);
  });
}

// Pickup 16.09 10:00 Kyiv time, return on 17.09.
const LONG_RIDE_CASES = [
  { id: "TC-44", rules: "T8", to: "11:00", desc: "25 год", total: 230000 },
  { id: "TC-45", rules: "T8", to: "10:00:00", desc: "рівно 24 год → без збору", total: 30000 },
  { id: "TC-46", rules: "T8", to: "10:00:01", desc: "24 год 1 с → 1 441 хв → зі збором", total: 230000 },
  { id: "TC-47", rules: "T7, T8", to: "11:00", station: "X01", desc: "25 год, станція X01", total: 245000 },
];

for (const c of LONG_RIDE_CASES) {
  test(`${c.rules}: ${c.id} — 16.09 10:00:00 → 17.09 ${c.to}, ${c.desc} → до сплати ${c.total}`, () => {
    const result = quote(ride({ from: "10:00:00", to: c.to, toDate: "2026-09-17", station: c.station }), rider());
    assert.equal(result.total, c.total);
  });
}
