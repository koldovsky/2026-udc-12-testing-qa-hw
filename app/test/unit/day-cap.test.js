import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP, dayKey } from "../../src/day-cap.js";

test("charges recorded for a day reduce what is left of the cap", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  assert.ok(ledger.remaining("rider-1", "2026-09-16T12:00:00Z") < DAY_CAP);
});

// T6: the ride belongs to the Kyiv calendar date of its pickup (tariffs.md:101-102);
// "доба" is the calendar date in Kyiv time (tariffs.md:34). The 21:00Z / 22:00Z instants
// fall on different dates in UTC and in Kyiv, so a UTC-based dayKey fails them.
test("the day of a ride is the date of its pickup", () => {
  for (const { id, pickupAt, day } of [
    { id: "same date in UTC and Kyiv",         pickupAt: "2026-09-16T08:00:00Z", day: "2026-09-16" },
    { id: "EEST: 21:00Z = 00:00 Kyiv next day", pickupAt: "2026-09-16T21:00:00Z", day: "2026-09-17" },
    { id: "EET: 22:00Z = 00:00 Kyiv next day",  pickupAt: "2026-10-27T22:00:00Z", day: "2026-10-28" },
  ]) {
    assert.equal(dayKey(pickupAt), day, id);
  }
});

// T6: a rider with no rides on a day has been charged nothing on it, so the whole cap is
// left (tariffs.md:100). Also kills M086 (?? 0 → ?? 1).
test("chargedOn returns 0 for a rider with no charges on that day", () => {
  const ledger = createDayCap();
  assert.equal(ledger.chargedOn("unknown-rider", "2026-09-16"), 0);
});
