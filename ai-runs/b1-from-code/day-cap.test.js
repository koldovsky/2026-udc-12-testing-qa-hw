import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP, dayKey } from "../../app/src/day-cap.js";

test("ledger defaults to the published cap and starts with full allowance", () => {
  const cap = createDayCap();
  assert.equal(cap.limit, DAY_CAP);
  assert.equal(cap.remaining("r1", "2026-09-16T12:00:00Z"), DAY_CAP);
  assert.equal(cap.chargedOn("r1", "2026-09-16"), 0);
});

test("recorded charges reduce remaining allowance and accumulate", () => {
  const cap = createDayCap({ limit: 5000 });
  cap.record("r1", "2026-09-16T08:00:00Z", 1200);
  cap.record("r1", "2026-09-16T19:00:00Z", 900);
  assert.equal(cap.chargedOn("r1", "2026-09-16"), 2100);
  assert.equal(cap.remaining("r1", "2026-09-16T22:00:00Z"), 2900);
});

test("ledger separates riders and pickup days", () => {
  const cap = createDayCap({ limit: 1000 });
  cap.record("r1", "2026-09-16T23:30:00Z", 800);
  assert.equal(cap.remaining("r1", "2026-09-17T00:30:00Z"), 1000);
  assert.equal(cap.remaining("r2", "2026-09-16T23:30:00Z"), 1000);
});

test("remaining allowance never becomes negative", () => {
  const cap = createDayCap({ limit: 1000 });
  cap.record("r1", "2026-09-16T08:00:00Z", 1400);
  assert.equal(cap.remaining("r1", "2026-09-16T09:00:00Z"), 0);
});

test("dayKey uses the UTC calendar date of the instant", () => {
  assert.equal(dayKey("2026-09-16T01:00:00+03:00"), "2026-09-15");
});
