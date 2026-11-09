import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DAY_CAP, dayKey, createDayCap } from "../../app/src/day-cap.js";

describe("dayKey", () => {
  test("returns the UTC date as YYYY-MM-DD", () => {
    assert.equal(dayKey("2026-01-15T10:00:00Z"), "2026-01-15");
    assert.equal(dayKey("2026-01-15T23:59:59Z"), "2026-01-15");
    assert.equal(dayKey("2026-01-16T00:00:00Z"), "2026-01-16");
  });

  test("normalises offsets to UTC", () => {
    assert.equal(dayKey("2026-01-15T22:30:00-05:00"), "2026-01-16");
    assert.equal(dayKey("2026-01-15T01:00:00+02:00"), "2026-01-14");
  });

  test("accepts epoch milliseconds", () => {
    assert.equal(dayKey(Date.UTC(2026, 0, 15, 12)), "2026-01-15");
  });
});

describe("createDayCap", () => {
  const T = "2026-01-15T10:00:00Z";

  test("default limit is DAY_CAP (30000 kopecks)", () => {
    assert.equal(DAY_CAP, 30000);
    const cap = createDayCap();
    assert.equal(cap.limit, DAY_CAP);
    assert.equal(cap.remaining("r1", T), DAY_CAP);
  });

  test("custom limit is respected", () => {
    const cap = createDayCap({ limit: 1000 });
    assert.equal(cap.limit, 1000);
    assert.equal(cap.remaining("r1", T), 1000);
  });

  test("record reduces remaining and accumulates", () => {
    const cap = createDayCap();
    cap.record("r1", T, 10000);
    assert.equal(cap.remaining("r1", T), 20000);
    cap.record("r1", "2026-01-15T18:00:00Z", 5000);
    assert.equal(cap.remaining("r1", T), 15000);
  });

  test("remaining never goes below zero", () => {
    const cap = createDayCap({ limit: 1000 });
    cap.record("r1", T, 5000);
    assert.equal(cap.remaining("r1", T), 0);
  });

  test("riders are tracked independently", () => {
    const cap = createDayCap();
    cap.record("r1", T, 30000);
    assert.equal(cap.remaining("r1", T), 0);
    assert.equal(cap.remaining("r2", T), DAY_CAP);
  });

  test("days are tracked independently", () => {
    const cap = createDayCap();
    cap.record("r1", T, 30000);
    assert.equal(cap.remaining("r1", "2026-01-16T10:00:00Z"), DAY_CAP);
  });

  test("ledgers are independent of each other", () => {
    const a = createDayCap();
    const b = createDayCap();
    a.record("r1", T, 100);
    assert.equal(b.remaining("r1", T), DAY_CAP);
  });

  test("chargedOn reports the booked total for a day, 0 if none", () => {
    const cap = createDayCap();
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 0);
    cap.record("r1", T, 1200);
    cap.record("r1", T, 300);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 1500);
    assert.equal(cap.chargedOn("r1", "2026-01-16"), 0);
    assert.equal(cap.chargedOn("r2", "2026-01-15"), 0);
  });

  test("recording zero leaves remaining unchanged", () => {
    const cap = createDayCap();
    cap.record("r1", T, 0);
    assert.equal(cap.remaining("r1", T), DAY_CAP);
  });
});
