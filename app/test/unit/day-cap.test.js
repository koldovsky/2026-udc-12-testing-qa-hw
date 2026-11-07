import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP, dayKey } from "../../src/day-cap.js";

test("charges recorded for a day reduce what is left of the cap", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T12:00:00Z"), DAY_CAP - 12000);
});

test("the day of a ride is the date of its pickup", () => {
  assert.equal(dayKey("2026-09-16T08:00:00Z"), "2026-09-16");
});

// T6 (docs/spec/tariffs.md:34, :101-102): the day is the Kyiv calendar date, not the UTC one.
test("the day of a ride is the Kyiv date of its pickup", () => {
  assert.equal(dayKey("2026-09-16T21:30:00Z"), "2026-09-17"); // 00:30 Kyiv on 17.09
  assert.equal(dayKey("2026-09-16T20:59:59Z"), "2026-09-16"); // 23:59:59 Kyiv on 16.09
});

test("the cap is 30 000 kopecks", () => {
  assert.equal(DAY_CAP, 30000);
  assert.equal(createDayCap().limit, 30000);
});

test("a rider with nothing recorded has the whole cap and was charged 0", () => {
  const ledger = createDayCap();
  assert.equal(ledger.remaining("rider-1", "2026-09-16T08:00:00Z"), 30000);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-16"), 0);
});

test("chargedOn sums what was recorded for the rider on that day", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  ledger.record("rider-1", "2026-09-16T15:00:00Z", 2500);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-16"), 14500);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T18:00:00Z"), 15500);
});

test("riders and days have separate ledgers", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  assert.equal(ledger.chargedOn("rider-2", "2026-09-16"), 0);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-17"), 0);
  assert.equal(ledger.remaining("rider-2", "2026-09-16T08:00:00Z"), 30000);
  assert.equal(ledger.remaining("rider-1", "2026-09-17T08:00:00Z"), 30000);
});

test("what is left of the cap never goes below 0", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 30000);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T09:00:00Z"), 0);
  ledger.record("rider-1", "2026-09-16T09:00:00Z", 500);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T10:00:00Z"), 0);
});

test("a custom limit replaces the default cap", () => {
  const ledger = createDayCap({ limit: 1000 });
  assert.equal(ledger.limit, 1000);
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 400);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T09:00:00Z"), 600);
});
