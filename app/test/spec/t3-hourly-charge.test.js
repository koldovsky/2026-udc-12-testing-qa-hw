// T3 — погодинне нарахування: docs/test-cases.md, TC-17…TC-22.
import test from "node:test";
import assert from "node:assert/strict";
import { amountDue, expectedDue, quoteRow, ride } from "./helpers.js";

// Станд. minutes — тривалість за T1, з якої T3 рахує розпочаті 30 хв.
const CASES = [
  { id: "TC-17", note: "клас., 50 хв → 2 блоки", ride: ride("16.09 10:00:00", "16.09 10:50:00"), minutes: 50, total: 5000 },
  { id: "TC-18", note: "ел., 75 хв → 3 блоки", ride: ride("16.09 10:00:00", "16.09 11:15:00", { bike: "ebike" }), minutes: 75, total: 12000 },
  { id: "TC-19", note: "клас., межа 60:00 → 2 блоки", ride: ride("16.09 10:00:00", "16.09 11:00:00"), minutes: 60, total: 5000 },
  { id: "TC-20", note: "клас., межа 60:01 → 61 хв, 3 блоки", ride: ride("16.09 10:00:00", "16.09 11:00:01"), minutes: 61, total: 7500 },
  { id: "TC-21", note: "ел., межа 30:00 → 1 блок", ride: ride("16.09 10:00:00", "16.09 10:30:00", { bike: "ebike" }), minutes: 30, total: 4000 },
  { id: "TC-22", note: "ел., межа 30:01 → 31 хв, 2 блоки", ride: ride("16.09 10:00:00", "16.09 10:30:01", { bike: "ebike" }), minutes: 31, total: 8000 },
];

for (const row of CASES) {
  test(`T3: ${row.id} — ${row.note} → ${row.total}`, () => {
    const result = quoteRow(row);
    assert.deepEqual(
      { minutes: result.minutes, ...amountDue(result) },
      { minutes: row.minutes, ...expectedDue(row.total) },
    );
  });
}
