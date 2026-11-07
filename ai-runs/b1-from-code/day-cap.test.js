import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DAY_CAP, dayKey, createDayCap } from "../../app/src/day-cap.js";

describe("DAY_CAP", () => {
  test("is 300 UAH in kopecks", () => {
    assert.equal(DAY_CAP, 30000);
  });
});

describe("dayKey", () => {
  test("returns YYYY-MM-DD for an epoch-ms instant", () => {
    assert.equal(dayKey(Date.parse("2026-11-06T10:00:00Z")), "2026-11-06");
  });

  test("accepts an ISO string with an offset", () => {
    assert.equal(dayKey("2026-11-06T10:00:00+02:00"), "2026-11-06");
  });

  test("uses the UTC date (current behaviour)", () => {
    assert.equal(dayKey("2026-11-05T23:30:00Z"), "2026-11-05");
  });

  // The service is for a Kyiv community and night pricing uses Kyiv time,
  // but dayKey groups by the UTC date: a ride at 00:30 Kyiv lands on the previous day.
  test("groups rides by the Kyiv calendar day", { todo: "dayKey uses UTC, not Europe/Kyiv" }, () => {
    assert.equal(dayKey("2026-11-06T00:30:00+02:00"), "2026-11-06");
  });
});

describe("createDayCap", () => {
  const t0 = Date.parse("2026-11-06T09:00:00Z");
  const t1 = Date.parse("2026-11-06T18:00:00Z");
  const nextDay = Date.parse("2026-11-07T09:00:00Z");

  test("defaults the limit to DAY_CAP", () => {
    const cap = createDayCap();
    assert.equal(cap.limit, DAY_CAP);
    assert.equal(cap.remaining("r1", t0), DAY_CAP);
  });

  test("accepts a custom limit", () => {
    const cap = createDayCap({ limit: 1000 });
    assert.equal(cap.limit, 1000);
    assert.equal(cap.remaining("r1", t0), 1000);
  });

  test("record accumulates charges within the same day", () => {
    const cap = createDayCap();
    cap.record("r1", t0, 10000);
    cap.record("r1", t1, 5000);
    assert.equal(cap.remaining("r1", t0), 15000);
    assert.equal(cap.chargedOn("r1", "2026-11-06"), 15000);
  });

  test("remaining never goes below zero", () => {
    const cap = createDayCap({ limit: 1000 });
    cap.record("r1", t0, 2500);
    assert.equal(cap.remaining("r1", t0), 0);
    assert.equal(cap.chargedOn("r1", "2026-11-06"), 2500);
  });

  test("days are tracked separately", () => {
    const cap = createDayCap();
    cap.record("r1", t0, DAY_CAP);
    assert.equal(cap.remaining("r1", t0), 0);
    assert.equal(cap.remaining("r1", nextDay), DAY_CAP);
    assert.equal(cap.chargedOn("r1", "2026-11-07"), 0);
  });

  test("riders are tracked separately", () => {
    const cap = createDayCap();
    cap.record("r1", t0, 20000);
    assert.equal(cap.remaining("r2", t0), DAY_CAP);
    assert.equal(cap.chargedOn("r2", "2026-11-06"), 0);
  });

  test("recording zero does not change the balance", () => {
    const cap = createDayCap();
    cap.record("r1", t0, 0);
    assert.equal(cap.remaining("r1", t0), DAY_CAP);
    assert.equal(cap.chargedOn("r1", "2026-11-06"), 0);
  });

  test("separate ledgers do not share state", () => {
    const a = createDayCap();
    const b = createDayCap();
    a.record("r1", t0, 10000);
    assert.equal(b.remaining("r1", t0), DAY_CAP);
  });
});
