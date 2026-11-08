// T1 — тривалість поїздки: docs/test-cases.md, TC-01…TC-07.
import test from "node:test";
import assert from "node:assert/strict";
import { amountDue, expectedDue, quoteRow, ride } from "./helpers.js";

// Клас., станд.
const CASES = [
  { id: "TC-01", note: "10:00:00 → 10:12:40: неповна хвилина — повна, 13 хв", ride: ride("16.09 10:00:00", "16.09 10:12:40"), minutes: 13, total: 2500 },
  { id: "TC-02", note: "14:05:00 → 14:41:00: 36 хв", ride: ride("16.09 14:05:00", "16.09 14:41:00"), minutes: 36, total: 5000 },
  { id: "TC-03", note: "межа 29:59 → 30 хв, 1 блок", ride: ride("16.09 10:00:00", "16.09 10:29:59"), minutes: 30, total: 2500 },
  { id: "TC-04", note: "межа 30:00 → 30 хв, 1 блок", ride: ride("16.09 10:00:00", "16.09 10:30:00"), minutes: 30, total: 2500 },
  { id: "TC-05", note: "межа 30:01 → 31 хв, 2 блоки", ride: ride("16.09 10:00:00", "16.09 10:30:01"), minutes: 31, total: 5000 },
  {
    id: "TC-06",
    note: "осінній перехід годинника: фактично 80 хв, нічна знижка",
    ride: ride("2026-10-25T02:50:00+03:00", "2026-10-25T03:10:00+02:00"),
    minutes: 80,
    total: 5250,
  },
  {
    id: "TC-07",
    note: "весняний перехід годинника: фактично 60 хв, нічна знижка",
    ride: ride("2027-03-28T02:30:00+02:00", "2027-03-28T04:30:00+03:00"),
    minutes: 60,
    total: 3500,
  },
];

for (const row of CASES) {
  test(`T1: ${row.id} — ${row.note} → ${row.total}`, () => {
    const result = quoteRow(row);
    assert.deepEqual(
      { minutes: result.minutes, ...amountDue(result) },
      { minutes: row.minutes, ...expectedDue(row.total) },
    );
  });
}
