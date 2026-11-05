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

// T6 (docs/spec/tariffs.md:100-101): the ledger never lets the time charge go over the cap; a custom limit tests the mechanism.
test("T6: remaining never goes below zero once the cap is overspent", () => {
  const ledger = createDayCap({ limit: 1000 });
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 1500);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T09:00:00Z"), 0);
});

// T6 (docs/spec/tariffs.md:100): the cap is per rider — a rider with no charges has the whole limit.
test("T6: remaining is the full limit for a rider with no charges", () => {
  assert.equal(createDayCap({ limit: 1000 }).remaining("nobody", "2026-09-16T08:00:00Z"), 1000);
});

// T6 (docs/spec/tariffs.md:100-102): «сума … одного користувача за одну добу» — per rider and per day.
test("T6: chargedOn is 0 for an unknown rider or day and sums recorded charges", () => {
  const ledger = createDayCap();
  assert.equal(ledger.chargedOn("rider-1", "2026-09-16"), 0);
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 2500);
  ledger.record("rider-1", "2026-09-16T10:00:00Z", 5000);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-16"), 7500);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-17"), 0);
  assert.equal(ledger.chargedOn("rider-2", "2026-09-16"), 0);
});
