// T8 — неповернений велосипед: docs/test-cases.md, TC-63…TC-69.
import test from "node:test";
import assert from "node:assert/strict";
import { amountDue, expectedDue, OUT_OF_ZONE, quoteRow, ride, SUBSCRIBER, UNRETURNED } from "./helpers.js";

// Клас., станд., якщо не вказано інше. minutes — тривалість за T1, від якої залежить «понад 24 год».
const CASES = [
  {
    id: "TC-63",
    note: "25 год: ліміт 30000 + збір T8",
    ride: ride("16.09 10:00:00", "17.09 11:00:00"),
    minutes: 1500,
    total: 230000,
    fees: { [UNRETURNED]: 200000 },
  },
  { id: "TC-64", note: "межа 23:59:59 → 1440 хв, збору немає", ride: ride("16.09 10:00:00", "17.09 09:59:59"), minutes: 1440, total: 30000 },
  { id: "TC-65", note: "межа рівно 24 год — не «понад», збору немає", ride: ride("16.09 10:00:00", "17.09 10:00:00"), minutes: 1440, total: 30000 },
  {
    id: "TC-66",
    note: "межа 24:00:01 → 1441 хв, збір T8",
    ride: ride("16.09 10:00:00", "17.09 10:00:01"),
    minutes: 1441,
    total: 230000,
    fees: { [UNRETURNED]: 200000 },
  },
  {
    id: "TC-67",
    note: "25 год, X01: обидва збори незалежно",
    ride: ride("16.09 10:00:00", "17.09 11:00:00", { station: "X01" }),
    minutes: 1500,
    total: 245000,
    fees: { [UNRETURNED]: 200000, [OUT_OF_ZONE]: 15000 },
  },
  {
    id: "TC-68",
    note: "за добу 27500 (П1), 25 год: погодинне — залишок ліміту + збір T8",
    before: ["P1"],
    ride: ride("16.09 14:00:00", "17.09 15:00:00"),
    minutes: 1500,
    total: 202500,
    fees: { [UNRETURNED]: 200000 },
  },
  {
    id: "TC-69",
    note: "абон., 25 год: ліміт 30000 + збір T8",
    rider: SUBSCRIBER,
    ride: ride("16.09 10:00:00", "17.09 11:00:00"),
    minutes: 1500,
    total: 230000,
    fees: { [UNRETURNED]: 200000 },
  },
];

for (const row of CASES) {
  test(`T8: ${row.id} — ${row.note} → ${row.total}`, () => {
    const result = quoteRow(row);
    assert.deepEqual(
      { minutes: result.minutes, ...amountDue(result) },
      { minutes: row.minutes, ...expectedDue(row.total, row.fees) },
    );
  });
}
