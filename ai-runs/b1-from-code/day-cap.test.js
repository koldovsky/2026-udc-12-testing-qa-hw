import test from "node:test";
import assert from "node:assert/strict";
import { DAY_CAP, createDayCap, dayKey } from "../../app/src/day-cap.js";

test("uses the default daily cap and derives the UTC calendar day", () => {
  assert.equal(DAY_CAP, 30000);
  assert.equal(dayKey("2026-01-15T23:30:00+02:00"), "2026-01-15");
});

test("remaining is capped at zero and records cumulative charges by rider and day", () => {
  const cap = createDayCap({ limit: 1000 });
  cap.record("alice", "2026-01-15T10:00:00Z", 700);
  cap.record("alice", "2026-01-15T12:00:00Z", 500);
  assert.equal(cap.chargedOn("alice", "2026-01-15"), 1200);
  assert.equal(cap.remaining("alice", "2026-01-15T13:00:00Z"), 0);
});

test("separates riders and days", () => {
  const cap = createDayCap({ limit: 1000 });
  cap.record("alice", "2026-01-15T23:59:00Z", 400);
  assert.equal(cap.remaining("bob", "2026-01-15T23:59:00Z"), 1000);
  assert.equal(cap.remaining("alice", "2026-01-16T00:00:00Z"), 1000);
  assert.equal(cap.chargedOn("alice", "2026-01-15"), 400);
  assert.equal(cap.chargedOn("alice", "2026-01-16"), 0);
});

test("supports a zero custom limit and unknown entries are empty", () => {
  const cap = createDayCap({ limit: 0 });
  assert.equal(cap.remaining("missing", "2026-01-15T00:00:00Z"), 0);
  assert.equal(cap.chargedOn("missing", "2026-01-15"), 0);
});
