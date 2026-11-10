import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_CAP, dayKey, createDayCap } from "../../app/src/day-cap.js";

test("DAY_CAP is 30000 kopecks", () => {
  assert.equal(DAY_CAP, 30000);
});

test("dayKey returns the UTC date of the instant (ms or ISO string)", () => {
  assert.equal(dayKey(Date.parse("2026-06-15T10:00:00Z")), "2026-06-15");
  assert.equal(dayKey("2026-06-15T23:59:59Z"), "2026-06-15");
  assert.equal(dayKey("2026-06-16T00:00:00Z"), "2026-06-16");
  // 01:00 Kyiv time (+03:00) on the 16th is still the 15th in UTC
  assert.equal(dayKey("2026-06-16T01:00:00+03:00"), "2026-06-15");
});

test("new ledger: default limit, full allowance, nothing charged", () => {
  const cap = createDayCap();
  assert.equal(cap.limit, DAY_CAP);
  assert.equal(cap.remaining("r1", "2026-06-15T10:00:00Z"), DAY_CAP);
  assert.equal(cap.chargedOn("r1", "2026-06-15"), 0);
});

test("custom limit is used", () => {
  const cap = createDayCap({ limit: 1000 });
  assert.equal(cap.limit, 1000);
  assert.equal(cap.remaining("r1", "2026-06-15T10:00:00Z"), 1000);
});

test("record reduces remaining and accumulates in chargedOn", () => {
  const cap = createDayCap();
  cap.record("r1", "2026-06-15T10:00:00Z", 5000);
  cap.record("r1", "2026-06-15T20:00:00Z", 2500);
  assert.equal(cap.remaining("r1", "2026-06-15T10:00:00Z"), DAY_CAP - 7500);
  assert.equal(cap.chargedOn("r1", "2026-06-15"), 7500);
});

test("remaining never goes below zero", () => {
  const cap = createDayCap({ limit: 1000 });
  cap.record("r1", "2026-06-15T10:00:00Z", 1500);
  assert.equal(cap.remaining("r1", "2026-06-15T10:00:00Z"), 0);
  assert.equal(cap.chargedOn("r1", "2026-06-15"), 1500);
});

test("riders and days are tracked independently", () => {
  const cap = createDayCap();
  cap.record("r1", "2026-06-15T10:00:00Z", 4000);
  assert.equal(cap.remaining("r2", "2026-06-15T10:00:00Z"), DAY_CAP);
  assert.equal(cap.remaining("r1", "2026-06-16T10:00:00Z"), DAY_CAP);
  assert.equal(cap.chargedOn("r1", "2026-06-16"), 0);
});

test("ledgers are independent of each other", () => {
  const a = createDayCap();
  const b = createDayCap();
  a.record("r1", "2026-06-15T10:00:00Z", 100);
  assert.equal(b.chargedOn("r1", "2026-06-15"), 0);
});

test("recording 0 is harmless", () => {
  const cap = createDayCap();
  cap.record("r1", "2026-06-15T10:00:00Z", 0);
  assert.equal(cap.remaining("r1", "2026-06-15T10:00:00Z"), DAY_CAP);
});
