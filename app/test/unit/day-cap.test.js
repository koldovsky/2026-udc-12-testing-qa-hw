import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP, dayKey } from "../../src/day-cap.js";

// T6 (docs/spec/tariffs.md:98-101): 300 UAH per rider per day.
test("the daily cap is 300 UAH", () => {
  assert.equal(DAY_CAP, 30000);
  assert.equal(createDayCap().limit, 30000);
});

test("charges recorded for a day reduce what is left of the cap", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T12:00:00Z"), 18000);
});

test("what is left of the cap never goes below zero", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 35000);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T12:00:00Z"), 0);
});

test("charges are kept per rider and per day", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  ledger.record("rider-1", "2026-09-16T10:00:00Z", 5000);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-16"), 17000);
  assert.equal(ledger.remaining("rider-2", "2026-09-16T12:00:00Z"), DAY_CAP);
  assert.equal(ledger.remaining("rider-1", "2026-09-17T12:00:00Z"), DAY_CAP);
});

test("nothing is charged for a rider or day with no rides", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  assert.equal(ledger.chargedOn("rider-2", "2026-09-16"), 0);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-17"), 0);
});

test("a custom limit replaces the default cap", () => {
  const ledger = createDayCap({ limit: 1000 });
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 400);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T12:00:00Z"), 600);
});

test("the day of a ride is the date of its pickup", () => {
  assert.equal(dayKey("2026-09-16T08:00:00Z"), "2026-09-16");
});

// T6 «Доба»: the Kyiv calendar date — 23:40 UTC on 16.09 is already 17.09 in Kyiv (UTC+3).
test("the day of a ride is the Kyiv calendar date, not the UTC one", () => {
  assert.equal(dayKey("2026-09-16T23:40:00Z"), "2026-09-17");
  assert.equal(dayKey("2026-09-16T23:40:00+03:00"), "2026-09-16");
});
