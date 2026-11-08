// T2 — хибний старт: docs/test-cases.md, TC-08…TC-16, TC-99.
import test from "node:test";
import assert from "node:assert/strict";
import { amountDue, expectedDue, OUT_OF_ZONE, quoteRow, REDUCED, ride } from "./helpers.js";

// Клас., станд., якщо не вказано інше. minutes — тривалість за T1, від якої залежить T2.
const CASES = [
  { id: "TC-08", note: "50 с → 1 хв, без погодинного нарахування", ride: ride("16.09 10:00:00", "16.09 10:00:50"), minutes: 1, total: 0 },
  { id: "TC-09", note: "межа 1:59 → 2 хв", ride: ride("16.09 10:00:00", "16.09 10:01:59"), minutes: 2, total: 0 },
  { id: "TC-10", note: "межа 2:00 — «не більше 2 хвилин»", ride: ride("16.09 10:00:00", "16.09 10:02:00"), minutes: 2, total: 0 },
  { id: "TC-11", note: "межа 2:01 → 3 хв, 1 блок", ride: ride("16.09 10:00:00", "16.09 10:02:01"), minutes: 3, total: 2500 },
  { id: "TC-12", note: "4 хв → 1 блок", ride: ride("16.09 10:00:00", "16.09 10:04:00"), minutes: 4, total: 2500 },
  { id: "TC-13", note: "повернення в ту саму секунду не відхиляється, 0 хв", ride: ride("16.09 10:00:00", "16.09 10:00:00"), minutes: 0, total: 0 },
  { id: "TC-14", note: "ел., 2 хв — не залежить від типу велосипеда", ride: ride("16.09 10:00:00", "16.09 10:02:00", { bike: "ebike" }), minutes: 2, total: 0 },
  {
    id: "TC-15",
    note: "1 хв 30 с, X01 — збір T7 нараховується",
    ride: ride("16.09 10:00:00", "16.09 10:01:30", { station: "X01" }),
    minutes: 2,
    total: 15000,
    fees: { [OUT_OF_ZONE]: 15000 },
  },
  {
    id: "TC-16",
    note: "пільг., 2 хв, X01 — пільга на збір не поширюється",
    ride: ride("16.09 10:00:00", "16.09 10:02:00", { station: "X01" }),
    rider: REDUCED,
    minutes: 2,
    total: 15000,
    fees: { [OUT_OF_ZONE]: 15000 },
  },
  { id: "TC-99", note: "межа 1:01 → 2 хв, без погодинного нарахування", ride: ride("16.09 10:00:00", "16.09 10:01:01"), minutes: 2, total: 0 },
];

for (const row of CASES) {
  test(`T2: ${row.id} — ${row.note} → ${row.total}`, () => {
    const result = quoteRow(row);
    assert.deepEqual(
      { minutes: result.minutes, ...amountDue(result) },
      { minutes: row.minutes, ...expectedDue(row.total, row.fees) },
    );
  });
}
