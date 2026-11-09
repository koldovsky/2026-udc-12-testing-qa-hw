import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP, dayKey } from "../../app/src/day-cap.js";

test("uses the exported default limit", () => {
  const cap = createDayCap();
  assert.equal(cap.limit, DAY_CAP);
  assert.equal(cap.remaining("r1", "2026-09-16T10:00:00Z"), DAY_CAP);
});

test("tracks charges separately by rider and UTC calendar day", () => {
  const cap = createDayCap({ limit: 1000 });
  cap.record("r1", "2026-09-16T23:30:00-04:00", 400);

  assert.equal(cap.chargedOn("r1", "2026-09-17"), 400);
  assert.equal(cap.chargedOn("r1", "2026-09-16"), 0);
  assert.equal(cap.chargedOn("r2", "2026-09-17"), 0);
  assert.equal(cap.remaining("r1", "2026-09-17T08:00:00Z"), 600);
});

test("record accumulates amounts and remaining never falls below zero", () => {
  const cap = createDayCap({ limit: 1000 });
  cap.record("r1", "2026-09-16T08:00:00Z", 700);
  cap.record("r1", "2026-09-16T09:00:00Z", 500);

  assert.equal(cap.chargedOn("r1", "2026-09-16"), 1200);
  assert.equal(cap.remaining("r1", "2026-09-16T23:59:00Z"), 0);
});

test("dayKey derives the day from the UTC instant", () => {
  assert.equal(dayKey("2026-09-16T23:30:00-04:00"), "2026-09-17");
});
