import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DAY_CAP, dayKey, createDayCap } from "../../app/src/day-cap.js";

describe("DAY_CAP / dayKey", () => {
  test("default cap is 30000 kopecks", () => {
    assert.equal(DAY_CAP, 30000);
  });

  test("dayKey returns YYYY-MM-DD for an ISO string, Date and epoch ms", () => {
    const iso = "2026-01-15T12:00:00Z";
    assert.equal(dayKey(iso), "2026-01-15");
    assert.equal(dayKey(new Date(iso)), "2026-01-15");
    assert.equal(dayKey(Date.parse(iso)), "2026-01-15");
  });

  test("dayKey gives the same key for instants on the same day", () => {
    assert.equal(dayKey("2026-01-15T00:00:00Z"), dayKey("2026-01-15T23:59:59Z"));
    assert.notEqual(dayKey("2026-01-15T23:59:59Z"), dayKey("2026-01-16T00:00:00Z"));
  });
});

describe("createDayCap", () => {
  const T = "2026-01-15T12:00:00Z";

  test("exposes the default limit and accepts a custom one", () => {
    assert.equal(createDayCap().limit, DAY_CAP);
    assert.equal(createDayCap({ limit: 100 }).limit, 100);
  });

  test("a fresh ledger has the full limit remaining and nothing charged", () => {
    const cap = createDayCap();
    assert.equal(cap.remaining("r1", T), DAY_CAP);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 0);
  });

  test("record reduces remaining and accumulates in chargedOn", () => {
    const cap = createDayCap();
    cap.record("r1", T, 10000);
    cap.record("r1", "2026-01-15T18:00:00Z", 5000);
    assert.equal(cap.remaining("r1", T), DAY_CAP - 15000);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 15000);
  });

  test("remaining never goes below zero when overbooked", () => {
    const cap = createDayCap({ limit: 1000 });
    cap.record("r1", T, 1000);
    assert.equal(cap.remaining("r1", T), 0);
    cap.record("r1", T, 500);
    assert.equal(cap.remaining("r1", T), 0);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 1500);
  });

  test("riders are tracked independently", () => {
    const cap = createDayCap();
    cap.record("r1", T, 20000);
    assert.equal(cap.remaining("r2", T), DAY_CAP);
    assert.equal(cap.chargedOn("r2", "2026-01-15"), 0);
  });

  test("days are tracked independently", () => {
    const cap = createDayCap();
    cap.record("r1", T, 20000);
    assert.equal(cap.remaining("r1", "2026-01-16T12:00:00Z"), DAY_CAP);
    assert.equal(cap.chargedOn("r1", "2026-01-16"), 0);
  });

  test("ledgers are independent of each other", () => {
    const a = createDayCap();
    const b = createDayCap();
    a.record("r1", T, 1000);
    assert.equal(b.remaining("r1", T), DAY_CAP);
  });

  test("recording zero leaves remaining unchanged", () => {
    const cap = createDayCap();
    cap.record("r1", T, 0);
    assert.equal(cap.remaining("r1", T), DAY_CAP);
  });
});
