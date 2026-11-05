// Daily cap across a rider's rides (T6).
// Cases and expected values: docs/test-cases.md, docs/spec/tariffs.md.
import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";

const FIRST_RIDER = { id: "rider-1", type: "standard" };
const OTHER_RIDER = { id: "rider-2", type: "standard" };
const REDUCED_RIDER = { id: "rider-3", type: "reduced" };

// Ф1 from docs/test-cases.md: three 80-minute e-bike rides that use up the cap of 16.09.
const F1_RIDES = [
  ["2026-09-16T09:00:00+03:00", "2026-09-16T10:20:00+03:00"],
  ["2026-09-16T13:00:00+03:00", "2026-09-16T14:20:00+03:00"],
  ["2026-09-16T18:00:00+03:00", "2026-09-16T19:20:00+03:00"],
].map(([pickupAt, returnAt]) => ({ pickupAt, returnAt, bike: "ebike", returnStation: "S01" }));

const rideF1 = (dayCap) => F1_RIDES.map((ride) => quote(ride, FIRST_RIDER, { dayCap }).total);

test("T6: TC-18 три поїздки електровелосипедом: третю обмежено лімітом 300 грн", () => {
  assert.deepEqual(rideF1(createDayCap()), [12000, 12000, 6000]);
});

const CASES = [
  { id: "TC-19", name: "взяття о 23:59:59 після Ф1: поїздка належить 16.09", rider: FIRST_RIDER, afterF1: true, pickupAt: "2026-09-16T23:59:59+03:00", returnAt: "2026-09-17T00:10:00+03:00", station: "S01", total: 0 },
  { id: "TC-20", name: "21:30Z — це вже 17.09 за Києвом: нова доба, новий ліміт", rider: FIRST_RIDER, afterF1: true, pickupAt: "2026-09-16T21:30:00Z", returnAt: "2026-09-16T21:50:00Z", station: "S01", total: 1750 },
  { id: "TC-21", name: "ліміт вичерпано: збір поза зоною все одно нараховано", rider: FIRST_RIDER, afterF1: true, pickupAt: "2026-09-16T20:00:00+03:00", returnAt: "2026-09-16T20:20:00+03:00", station: "X01", fees: [15000], total: 15000 },
  { id: "TC-22", name: "пільговий, 10 год: ліміт діє після знижки", rider: REDUCED_RIDER, afterF1: false, pickupAt: "2026-09-16T07:00:00+03:00", returnAt: "2026-09-16T17:00:00+03:00", station: "S01", total: 25000 },
  { id: "TC-23", name: "ліміт першого користувача не діє на іншого", rider: OTHER_RIDER, afterF1: true, pickupAt: "2026-09-16T20:00:00+03:00", returnAt: "2026-09-16T20:20:00+03:00", station: "S01", total: 2500 },
];

for (const row of CASES) {
  test(`T6: ${row.id} ${row.name}`, () => {
    const dayCap = createDayCap();
    if (row.afterF1) rideF1(dayCap);
    const ride = { pickupAt: row.pickupAt, returnAt: row.returnAt, bike: "classic", returnStation: row.station };

    const result = quote(ride, row.rider, { dayCap });

    assert.equal(result.total, row.total);
    assert.deepEqual(
      result.fees.map((fee) => fee.amount),
      row.fees ?? [],
    );
  });
}
