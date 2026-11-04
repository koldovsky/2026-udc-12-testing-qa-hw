import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createDayCap, dayKey, DAY_CAP } from "../../app/src/day-cap.js";

describe("dayKey", () => {
  test("returns YYYY-MM-DD for ms and ISO input", () => {
    assert.equal(dayKey(Date.parse("2026-09-16T07:00:00Z")), "2026-09-16");
    assert.equal(dayKey("2026-09-16T23:59:59Z"), "2026-09-16");
  });
  test("uses the UTC date (current behaviour)", () => {
    // 22:30Z on 15th is already 01:30 on 16th in Kyiv, but dayKey gives the UTC day.
    assert.equal(dayKey("2026-09-15T22:30:00Z"), "2026-09-15");
  });
});

describe("createDayCap", () => {
  const T = Date.parse("2026-09-16T07:00:00Z");

  test("default limit is DAY_CAP = 30000", () => {
    const cap = createDayCap();
    assert.equal(DAY_CAP, 30000);
    assert.equal(cap.limit, DAY_CAP);
    assert.equal(cap.remaining("r", T), DAY_CAP);
  });
  test("custom limit", () => {
    const cap = createDayCap({ limit: 1000 });
    assert.equal(cap.limit, 1000);
    assert.equal(cap.remaining("r", T), 1000);
  });
  test("record reduces remaining and accumulates", () => {
    const cap = createDayCap();
    cap.record("r", T, 10000);
    cap.record("r", T + 3600_000, 5000);
    assert.equal(cap.remaining("r", T), 15000);
    assert.equal(cap.chargedOn("r", "2026-09-16"), 15000);
  });
  test("remaining never goes below zero", () => {
    const cap = createDayCap();
    cap.record("r", T, 40000);
    assert.equal(cap.remaining("r", T), 0);
  });
  test("separate by rider and by day", () => {
    const cap = createDayCap();
    cap.record("a", T, 30000);
    assert.equal(cap.remaining("b", T), DAY_CAP);
    assert.equal(cap.remaining("a", T + 24 * 3600_000), DAY_CAP);
    assert.equal(cap.chargedOn("a", "2026-09-17"), 0);
  });
  test("chargedOn for unknown rider is 0", () => {
    assert.equal(createDayCap().chargedOn("nobody", "2026-09-16"), 0);
  });
  test("ledgers are independent", () => {
    const a = createDayCap();
    const b = createDayCap();
    a.record("r", T, 100);
    assert.equal(b.remaining("r", T), DAY_CAP);
  });
});
