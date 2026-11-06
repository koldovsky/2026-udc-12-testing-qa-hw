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

test("an empty ledger leaves the whole cap", () => {
  assert.equal(createDayCap().remaining("rider-1", "2026-09-16T08:00:00Z"), 30000);
});

test("a rider with no charges on a day has been charged nothing", () => {
  assert.equal(createDayCap().chargedOn("rider-1", "2026-09-16"), 0);
});

test("charges are summed per rider and per Kyiv day", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  ledger.record("rider-1", "2026-09-16T12:00:00Z", 3000);

  assert.equal(ledger.chargedOn("rider-1", "2026-09-16"), 15000);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T18:00:00Z"), 15000);
  assert.equal(ledger.chargedOn("rider-2", "2026-09-16"), 0);
  // 21:30Z on 16.09 is already 00:30 on 17.09 in Kyiv.
  assert.equal(ledger.remaining("rider-1", "2026-09-16T21:30:00Z"), 30000);
});
