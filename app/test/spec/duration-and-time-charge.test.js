import test from "node:test";
import assert from "node:assert/strict";
import { at, run } from "../helpers/spec.js";

// T1, T2, T3. Expected values: docs/test-cases.md and docs/spec/tariffs.md.
const d = (from, to) => ({ from: at(16, from), to: at(16, to) });

const cases = [
  // T1 — duration is rounded up to whole minutes
  { id: "TC-01", rule: "T1", name: "10:00:00→10:12:40 is 13 min", ...d("10:00:00", "10:12:40"), minutes: 13, total: 2500 },
  { id: "TC-02", rule: "T1", name: "14:05:00→14:41:00 is 36 min", ...d("14:05:00", "14:41:00"), minutes: 36, total: 5000 },
  { id: "TC-03", rule: "T1", name: "1 s rounds up to 1 min", ...d("12:00:00", "12:00:01"), minutes: 1, total: 0 },
  { id: "TC-04", rule: "T1", name: "exactly 30 min is 1 block", ...d("10:00:00", "10:30:00"), minutes: 30, total: 2500 },
  { id: "TC-05", rule: "T1", name: "30 min 1 s is 31 min, 2 blocks", ...d("10:00:00", "10:30:01"), minutes: 31, total: 5000 },
  // T2 — false start: up to and including 2 min is free
  { id: "TC-06", rule: "T2", name: "50 s is free", ...d("12:00:00", "12:00:50"), minutes: 1, total: 0 },
  { id: "TC-07", rule: "T2", name: "exactly 2 min is free", ...d("12:00:00", "12:02:00"), minutes: 2, total: 0 },
  { id: "TC-08", rule: "T2", name: "2 min 1 s is 3 min, charged", ...d("12:00:00", "12:02:01"), minutes: 3, total: 2500 },
  { id: "TC-09", rule: "T2", name: "4 min is 1 block", ...d("12:00:00", "12:04:00"), total: 2500 },
  { id: "TC-10", rule: "T2", name: "e-bike, 2 min is free", bike: "ebike", ...d("12:00:00", "12:02:00"), total: 0 },
  { id: "TC-11", rule: "T2", name: "free time, but the out-of-zone fee X03 is charged", station: "X03", ...d("12:00:00", "12:01:00"), total: 15000 },
  // T3 — 30-minute blocks
  { id: "TC-12", rule: "T3", name: "classic, 50 min is 2 blocks", ...d("12:00:00", "12:50:00"), total: 5000 },
  { id: "TC-13", rule: "T3", name: "e-bike, 75 min is 3 blocks", bike: "ebike", ...d("12:00:00", "13:15:00"), total: 12000 },
  { id: "TC-14", rule: "T3", name: "classic, 60 min is 2 blocks", ...d("12:00:00", "13:00:00"), total: 5000 },
  { id: "TC-15", rule: "T3", name: "classic, 61 min is 3 blocks", ...d("12:00:00", "13:01:00"), total: 7500 },
  { id: "TC-16", rule: "T3", name: "e-bike, 30 min is 1 block", bike: "ebike", ...d("12:00:00", "12:30:00"), total: 4000 },
  { id: "TC-17", rule: "T3", name: "e-bike, 31 min is 2 blocks", bike: "ebike", ...d("12:00:00", "12:31:00"), total: 8000 },
];

for (const c of cases) {
  test(`${c.rule}: ${c.id} ${c.name}`, () => {
    const result = run(c);
    if (c.minutes !== undefined) assert.equal(result.minutes, c.minutes);
    assert.equal(result.total, c.total);
  });
}
