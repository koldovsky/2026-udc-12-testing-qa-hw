// docs/test-cases.md TC-01…TC-15 — T1 (duration), T2 (false start), T3 (blocks).
// Expectations: docs/test-cases.md, docs/spec/tariffs.md:43-70.

import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";
import { ride, rider } from "../helpers/spec.js";

// Pickup and return in Kyiv time on 16.09; minutes — the duration by T1.
const DURATION_CASES = [
  { id: "TC-01", rules: "T1", from: "10:00:00", to: "10:12:40", minutes: 13, total: 2500 },
  { id: "TC-02", rules: "T1", from: "14:05:00", to: "14:41:00", minutes: 36, total: 5000 },
  { id: "TC-03", rules: "T1", from: "10:00:00", to: "10:30:00", minutes: 30, total: 2500 },
  { id: "TC-04", rules: "T1", from: "10:00:00", to: "10:30:01", minutes: 31, total: 5000 },
  { id: "TC-05", rules: "T1, T2", from: "10:00:00", to: "10:01:30", minutes: 2, total: 0 },
  { id: "TC-06", rules: "T2", from: "10:00:00", to: "10:00:50", minutes: 1, total: 0 },
  { id: "TC-07", rules: "T2", from: "10:00:00", to: "10:02:00", minutes: 2, total: 0 },
  { id: "TC-08", rules: "T2", from: "10:00:00", to: "10:02:01", minutes: 3, total: 2500 },
  { id: "TC-09", rules: "T2", from: "10:00", to: "10:04", minutes: 4, total: 2500 },
  { id: "TC-10", rules: "T2, T7", from: "10:00:00", to: "10:00:50", station: "X01", minutes: 1, total: 15000 },
  { id: "TC-11", rules: "T2, §4", from: "10:00:00", to: "10:00:00", minutes: 0, total: 0 },
];

for (const c of DURATION_CASES) {
  const where = c.station ? `, станція ${c.station}` : "";
  test(`${c.rules}: ${c.id} — ${c.from} → ${c.to}${where} → ${c.minutes} хв, до сплати ${c.total}`, () => {
    const result = quote(ride({ from: c.from, to: c.to, station: c.station }), rider());
    assert.deepEqual({ minutes: result.minutes, total: result.total }, { minutes: c.minutes, total: c.total });
  });
}

const BLOCK_CASES = [
  { id: "TC-12", bike: "classic", minutes: 50, total: 5000 },
  { id: "TC-13", bike: "ebike", minutes: 75, total: 12000 },
  { id: "TC-14", bike: "ebike", minutes: 60, total: 8000 },
  { id: "TC-15", bike: "ebike", minutes: 61, total: 12000 },
];

for (const c of BLOCK_CASES) {
  test(`T3: ${c.id} — ${c.bike}, ${c.minutes} хв → до сплати ${c.total}`, () => {
    const result = quote(ride({ minutes: c.minutes, bike: c.bike }), rider());
    assert.equal(result.total, c.total);
  });
}
