import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP, dayKey } from "../../src/day-cap.js";

test("charges recorded for a day reduce what is left of the cap", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  assert.ok(ledger.remaining("rider-1", "2026-09-16T12:00:00Z") < DAY_CAP);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T12:00:00Z"), 18000); // 300 UAH − 120 UAH, docs/spec/tariffs.md:100-101
});

test("the day of a ride is the date of its pickup", () => {
  assert.equal(dayKey("2026-09-16T08:00:00Z"), "2026-09-16");
  // 01:30 on 17.09 in Kyiv: the Kyiv date of the pickup decides (docs/spec/tariffs.md:34, 101-102)
  assert.equal(dayKey("2026-09-16T22:30:00Z"), "2026-09-17");
});

test("a rider with no rides that day has been charged nothing", () => {
  const ledger = createDayCap();
  assert.equal(ledger.chargedOn("rider-1", "2026-09-16"), 0); // T6 sums per rider and per day: docs/spec/tariffs.md:100-101
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-16"), 12000);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-17"), 0);
  assert.equal(ledger.chargedOn("rider-2", "2026-09-16"), 0);
});
