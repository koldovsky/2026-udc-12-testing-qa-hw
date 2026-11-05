// Behaviour snapshot, not verified against the spec (docs/spec/tariffs.md was not available; Kyiv-day rows follow the T6 rule from the repo rules).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDayCap, dayKey, DAY_CAP } from "../../app/src/day-cap.js";

test("default limit is 30000 kopecks", () => {
  assert.equal(DAY_CAP, 30000);
  assert.equal(createDayCap().limit, 30000);
});

test("custom limit", () => {
  const cap = createDayCap({ limit: 1000 });
  assert.equal(cap.limit, 1000);
  assert.equal(cap.remaining("a", "2026-09-16T12:00:00+03:00"), 1000);
});

test("remaining shrinks by recorded amounts", () => {
  const cap = createDayCap();
  const at = "2026-09-16T12:00:00+03:00";
  cap.record("a", at, 10000);
  cap.record("a", "2026-09-16T18:00:00+03:00", 5000);
  assert.equal(cap.remaining("a", at), 15000);
  assert.equal(cap.chargedOn("a", "2026-09-16"), 15000);
});

test("remaining never goes below 0", () => {
  const cap = createDayCap({ limit: 1000 });
  cap.record("a", "2026-09-16T12:00:00+03:00", 1500);
  assert.equal(cap.remaining("a", "2026-09-16T12:00:00+03:00"), 0);
});

test("riders are independent", () => {
  const cap = createDayCap();
  cap.record("a", "2026-09-16T12:00:00+03:00", 30000);
  assert.equal(cap.remaining("a", "2026-09-16T12:00:00+03:00"), 0);
  assert.equal(cap.remaining("b", "2026-09-16T12:00:00+03:00"), 30000);
  assert.equal(cap.chargedOn("b", "2026-09-16"), 0);
});

test("chargedOn is 0 for an unknown day", () => {
  assert.equal(createDayCap().chargedOn("a", "2026-01-01"), 0);
});

// instant, expected Kyiv day (summer, UTC+3)
const days = [
  ["2026-09-16T12:00:00+03:00", "2026-09-16"],
  ["2026-09-16T23:59:59+03:00", "2026-09-16"], // 20:59:59Z
  ["2026-09-17T00:00:00+03:00", "2026-09-17"], // 21:00:00Z
  ["2026-09-16T20:59:59Z", "2026-09-16"],
  ["2026-09-16T21:00:00Z", "2026-09-17"],
];
for (const [instant, day] of days) {
  test(`T6: Kyiv day of ${instant} is ${day}`, () => {
    assert.equal(dayKey(instant), day);
  });
}

test("T6: ledger separates days at Kyiv midnight", () => {
  const cap = createDayCap();
  cap.record("a", "2026-09-16T23:59:59+03:00", 30000);
  assert.equal(cap.remaining("a", "2026-09-17T00:00:00+03:00"), 30000);
  assert.equal(cap.remaining("a", "2026-09-16T23:59:59+03:00"), 0);
});
