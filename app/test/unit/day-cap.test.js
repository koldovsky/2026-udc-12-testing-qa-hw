import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP, dayKey } from "../../src/day-cap.js";

test("charges recorded for a day reduce what is left of the cap", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  assert.ok(ledger.remaining("rider-1", "2026-09-16T12:00:00Z") < DAY_CAP);
});

test("the day of a ride is the date of its pickup", () => {
  assert.equal(dayKey("2026-09-16T08:00:00Z"), "2026-09-16");
});

// T6 (docs/spec/tariffs.md:100-103): the cap is 30000 per rider per Kyiv calendar day.
test("a day with no charges has 0 charged and the whole cap left", () => {
  const ledger = createDayCap();
  assert.deepEqual(
    { charged: ledger.chargedOn("rider-1", "2026-09-16"), left: ledger.remaining("rider-1", "2026-09-16T12:00:00+03:00") },
    { charged: 0, left: 30000 },
  );
});

// T6: the charges of one rider on one Kyiv day add up; a ride belongs to the day of its pickup
// in Kyiv time (:101-102); another day and another rider have their own sums.
test("chargedOn sums one rider's charges of one Kyiv day, apart from other days and riders", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00+03:00", 12000);
  ledger.record("rider-1", "2026-09-16T23:40:00+03:00", 5000); // 20:40Z — still 16.09 in Kyiv
  ledger.record("rider-1", "2026-09-17T00:30:00+03:00", 2500); // 16.09 21:30Z — already 17.09 in Kyiv
  ledger.record("rider-2", "2026-09-16T09:00:00+03:00", 4000);
  assert.deepEqual(
    {
      rider1on16: ledger.chargedOn("rider-1", "2026-09-16"),
      rider1on17: ledger.chargedOn("rider-1", "2026-09-17"),
      rider2on16: ledger.chargedOn("rider-2", "2026-09-16"),
      rider1leftOn16: ledger.remaining("rider-1", "2026-09-16T18:00:00+03:00"),
    },
    { rider1on16: 17000, rider1on17: 2500, rider2on16: 4000, rider1leftOn16: 13000 },
  );
});
