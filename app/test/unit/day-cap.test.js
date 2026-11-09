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

test("a rider with no charges has the whole cap left", () => {
  const ledger = createDayCap();
  assert.equal(ledger.remaining("nobody", "2026-09-16T08:00:00Z"), DAY_CAP);
});

test("remaining is reduced by exactly what was recorded and never below zero", () => {
  const ledger = createDayCap({ limit: 1000 });
  ledger.record("r", "2026-09-16T08:00:00Z", 300);
  ledger.record("r", "2026-09-16T09:00:00Z", 200);
  assert.equal(ledger.remaining("r", "2026-09-16T10:00:00Z"), 500);
  ledger.record("r", "2026-09-16T11:00:00Z", 900);
  assert.equal(ledger.remaining("r", "2026-09-16T12:00:00Z"), 0);
});

test("chargedOn is zero for an unknown day or rider and sums a day's charges", () => {
  const ledger = createDayCap();
  assert.equal(ledger.chargedOn("r", "2026-09-16"), 0);
  ledger.record("r", "2026-09-16T08:00:00Z", 300);
  ledger.record("r", "2026-09-16T09:00:00Z", 200);
  assert.equal(ledger.chargedOn("r", "2026-09-16"), 500);
  assert.equal(ledger.chargedOn("r", "2026-09-17"), 0);
  assert.equal(ledger.chargedOn("other", "2026-09-16"), 0);
});

test("charges are kept per rider and per Kyiv day", () => {
  const ledger = createDayCap();
  ledger.record("r", "2026-09-16T20:59:00Z", 1000); // 23:59 Kyiv, 16.09
  assert.equal(ledger.remaining("r", "2026-09-16T21:00:00Z"), DAY_CAP); // 00:00 Kyiv, 17.09
  assert.equal(ledger.remaining("other", "2026-09-16T20:59:00Z"), DAY_CAP);
});
