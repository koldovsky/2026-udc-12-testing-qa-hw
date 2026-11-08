// T4 — абонемент: docs/test-cases.md, TC-23…TC-31.
import test from "node:test";
import assert from "node:assert/strict";
import { amountDue, expectedDue, quoteRow, ride, SUBSCRIBER } from "./helpers.js";

const ebike = { bike: "ebike" };

// Абон. (без права на пільгу). minutes — тривалість за T1, від якої T4 відраховує 45 безкоштовних.
const CASES = [
  { id: "TC-23", note: "клас., 40 хв у межах 45 безкоштовних", ride: ride("16.09 10:00:00", "16.09 10:40:00"), minutes: 40, total: 0 },
  { id: "TC-24", note: "клас., 100 хв → 55 платних, 2 блоки", ride: ride("16.09 10:00:00", "16.09 11:40:00"), minutes: 100, total: 5000 },
  { id: "TC-25", note: "клас., межа 45:00 → безкоштовно", ride: ride("16.09 10:00:00", "16.09 10:45:00"), minutes: 45, total: 0 },
  { id: "TC-26", note: "клас., межа 45:01 → 46 хв, 1 платна, 1 блок", ride: ride("16.09 10:00:00", "16.09 10:45:01"), minutes: 46, total: 2500 },
  { id: "TC-27", note: "клас., межа 75:00 → 30 платних, 1 блок", ride: ride("16.09 10:00:00", "16.09 11:15:00"), minutes: 75, total: 2500 },
  { id: "TC-28", note: "клас., межа 75:01 → 31 платна, 2 блоки", ride: ride("16.09 10:00:00", "16.09 11:15:01"), minutes: 76, total: 5000 },
  { id: "TC-29", note: "ел., 30 хв → 1 блок − 20 %", ride: ride("16.09 10:00:00", "16.09 10:30:00", ebike), minutes: 30, total: 3200 },
  { id: "TC-30", note: "ел., 45 хв — безкоштовних хвилин немає, 2 блоки − 20 %", ride: ride("16.09 10:00:00", "16.09 10:45:00", ebike), minutes: 45, total: 6400 },
  { id: "TC-31", note: "ел., 76 хв → 3 блоки − 20 %", ride: ride("16.09 10:00:00", "16.09 11:16:00", ebike), minutes: 76, total: 9600 },
];

for (const row of CASES) {
  test(`T4: ${row.id} — ${row.note} → ${row.total}`, () => {
    const result = quoteRow({ rider: SUBSCRIBER, ...row });
    assert.deepEqual(
      { minutes: result.minutes, ...amountDue(result) },
      { minutes: row.minutes, ...expectedDue(row.total) },
    );
  });
}
