// T6 — денний ліміт: docs/test-cases.md, TC-43…TC-56, TC-91…TC-93.
// «За добу» — попередні поїздки того самого користувача П1–П4 (helpers.js, PRIOR_RIDES).
import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";
import { amountDue, expectedDue, OUT_OF_ZONE, quoteRow, REDUCED, ride, STANDARD, SUBSCRIBER, UNRETURNED } from "./helpers.js";

const ebike = { bike: "ebike" };

test("T6: TC-43 — три поїздки ел. по 80 хв за 16.09: 12000, 12000, третя до ліміту 6000", () => {
  const dayCap = createDayCap();
  const rider = { ...STANDARD, id: "rider-1" };
  const totals = [
    ride("16.09 09:00:00", "16.09 10:20:00", ebike),
    ride("16.09 13:00:00", "16.09 14:20:00", ebike),
    ride("16.09 18:00:00", "16.09 19:20:00", ebike),
  ].map((r) => quote(r, rider, { dayCap }).total);
  assert.deepEqual(totals, [12000, 12000, 6000]);
});

// Клас., станд., якщо не вказано інше.
const CASES = [
  { id: "TC-44", note: "за добу 27500 (П1), 30 хв: 2500 = залишку", before: ["P1"], ride: ride("16.09 14:00:00", "16.09 14:30:00"), total: 2500 },
  { id: "TC-45", note: "за добу 27500 (П1), 31 хв: 5000 > залишку", before: ["P1"], ride: ride("16.09 14:00:00", "16.09 14:31:00"), total: 2500 },
  { id: "TC-46", note: "за добу 30000 (П3): ліміт вичерпано", before: ["P3"], ride: ride("16.09 20:00:00", "16.09 20:30:00"), total: 0 },
  { id: "TC-47", note: "одна поїздка, межа 360 хв: рівно ліміт", ride: ride("16.09 10:00:00", "16.09 16:00:00"), total: 30000 },
  { id: "TC-48", note: "одна поїздка, межа 361 хв: 32500 → ліміт", ride: ride("16.09 10:00:00", "16.09 16:00:01"), total: 30000 },
  {
    id: "TC-49",
    note: "ел., абон., за добу 22500 (П2): ліміт після знижки T4",
    before: ["P2"],
    rider: SUBSCRIBER,
    ride: ride("16.09 13:00:00", "16.09 14:15:00", ebike),
    total: 7500,
  },
  {
    id: "TC-50",
    note: "пільг., 600 хв: ліміт після знижки T5",
    rider: REDUCED,
    ride: ride("16.09 10:00:00", "16.09 20:00:00"),
    total: 25000,
  },
  {
    id: "TC-51",
    note: "ел., 00:00:00 → 05:59:59: ліміт після нічної знижки T10",
    ride: ride("16.09 00:00:00", "16.09 05:59:59", ebike),
    total: 30000,
  },
  {
    id: "TC-52",
    note: "за 16.09 27500 (П1), 23:40 → 17.09 00:20: поїздка належить до доби взяття",
    before: ["P1"],
    ride: ride("16.09 23:40:00", "17.09 00:20:00"),
    total: 2500,
  },
  {
    id: "TC-53",
    note: "за 16.09 30000 (П3), взяття 17.09 00:30 (= 16.09 21:30Z): доба за київським часом",
    before: ["P3"],
    ride: ride("2026-09-17T00:30:00+03:00", "2026-09-17T01:00:00+03:00"),
    total: 1750,
  },
  {
    id: "TC-54",
    note: "у користувача A за добу 30000 (П3), поїздка користувача B: ліміт окремий",
    before: [{ prior: "P3", riderId: "rider-A" }],
    riderId: "rider-B",
    ride: ride("16.09 21:00:00", "16.09 21:30:00"),
    total: 2500,
  },
  {
    id: "TC-55",
    note: "за добу 30000 (П3), X02: збір поза лімітом",
    before: ["P3"],
    ride: ride("16.09 20:00:00", "16.09 20:20:00", { station: "X02" }),
    total: 15000,
    fees: { [OUT_OF_ZONE]: 15000 },
  },
  {
    id: "TC-56",
    note: "ел., 16.09 10:00 → 19.09 10:00: один ліміт доби взяття + збір T8",
    ride: ride("16.09 10:00:00", "19.09 10:00:00", ebike),
    total: 230000,
    fees: { [UNRETURNED]: 200000 },
  },
  {
    id: "TC-91",
    note: "за 16.09 30000 (П3), межа доби: взяття 23:59:59 — ще 16.09",
    before: ["P3"],
    ride: ride("2026-09-16T23:59:59+03:00", "2026-09-17T00:29:59+03:00"),
    total: 0,
  },
  {
    id: "TC-92",
    note: "за 16.09 30000 (П3), межа доби: взяття 00:00:00 — уже 17.09",
    before: ["P3"],
    ride: ride("2026-09-17T00:00:00+03:00", "2026-09-17T00:30:00+03:00"),
    total: 1750,
  },
  {
    id: "TC-93",
    note: "за 16.11 30000 (П4), взимку +02:00: взяття 23:20 — ще 16.11",
    before: ["P4"],
    ride: ride("2026-11-16T23:20:00+02:00", "2026-11-16T23:50:00+02:00"),
    total: 0,
  },
];

for (const row of CASES) {
  test(`T6: ${row.id} — ${row.note} → ${row.total}`, () => {
    assert.deepEqual(amountDue(quoteRow(row)), expectedDue(row.total, row.fees));
  });
}
