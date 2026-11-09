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

test("a fresh ledger has the full allowance and no recorded charge", () => {
  const ledger = createDayCap();
  assert.equal(ledger.remaining("rider-new", "2026-09-16T08:00:00Z"), DAY_CAP);
  assert.equal(ledger.chargedOn("rider-new", "2026-09-16"), 0);
});

test("remaining allowance never goes below zero after overcharging", () => {
  const ledger = createDayCap();
  ledger.record("rider-over", "2026-09-16T08:00:00Z", DAY_CAP + 5000);
  assert.equal(ledger.remaining("rider-over", "2026-09-16T12:00:00Z"), 0);
});
