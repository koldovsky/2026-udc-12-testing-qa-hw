// T7 — повернення поза зоною: docs/test-cases.md, TC-57…TC-62.
import test from "node:test";
import assert from "node:assert/strict";
import { amountDue, expectedDue, OUT_OF_ZONE, quoteRow, ride, SUBSCRIBER } from "./helpers.js";

const IN_ZONE = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"];

// Клас., станд., якщо не вказано інше.
const CASES = [
  {
    id: "TC-57",
    note: "20 хв, X01",
    ride: ride("16.09 10:00:00", "16.09 10:20:00", { station: "X01" }),
    total: 17500,
    fees: { [OUT_OF_ZONE]: 15000 },
  },
  {
    id: "TC-58",
    note: "ел., 30 хв, X02",
    ride: ride("16.09 10:00:00", "16.09 10:30:00", { bike: "ebike", station: "X02" }),
    total: 19000,
    fees: { [OUT_OF_ZONE]: 15000 },
  },
  {
    id: "TC-59",
    note: "20 хв, X03",
    ride: ride("16.09 10:00:00", "16.09 10:20:00", { station: "X03" }),
    total: 17500,
    fees: { [OUT_OF_ZONE]: 15000 },
  },
  ...IN_ZONE.map((station) => ({
    id: "TC-60",
    note: `20 хв, ${station} у зоні — збору немає`,
    ride: ride("16.09 10:00:00", "16.09 10:20:00", { station }),
    total: 2500,
  })),
  {
    id: "TC-61",
    note: "абон., 40 хв, X02: абонемент діє лише на погодинне",
    rider: SUBSCRIBER,
    ride: ride("16.09 10:00:00", "16.09 10:40:00", { station: "X02" }),
    total: 15000,
    fees: { [OUT_OF_ZONE]: 15000 },
  },
  {
    id: "TC-62",
    note: "01:10 → 01:40, X01: нічна знижка не зменшує збір",
    ride: ride("16.09 01:10:00", "16.09 01:40:00", { station: "X01" }),
    total: 16750,
    fees: { [OUT_OF_ZONE]: 15000 },
  },
];

for (const row of CASES) {
  test(`T7: ${row.id} — ${row.note} → ${row.total}`, () => {
    assert.deepEqual(amountDue(quoteRow(row)), expectedDue(row.total, row.fees));
  });
}
