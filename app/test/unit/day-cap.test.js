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

test("remaining of a rider with no charges on that day is the full cap", () => {
  const ledger = createDayCap();
  assert.equal(ledger.remaining("rider-x", "2026-09-16T08:00:00Z"), DAY_CAP);
});

test("chargedOn of a rider with no charges on that day is zero", () => {
  const ledger = createDayCap();
  assert.equal(ledger.chargedOn("rider-x", "2026-09-16"), 0);
});

test("remaining is zero once the rider is charged up to the cap", () => {
  const ledger = createDayCap();
  ledger.record("rider-full", "2026-09-16T08:00:00Z", DAY_CAP);
  assert.equal(ledger.remaining("rider-full", "2026-09-16T09:00:00Z"), 0);
});
