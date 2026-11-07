// Unit tests for app/src/day-cap.js — written from the code (no spec available to the author).
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { DAY_CAP, createDayCap, dayKey } from "../../app/src/day-cap.js";

describe("DAY_CAP", () => {
  test("is 300 UAH in kopecks", () => {
    assert.equal(DAY_CAP, 30000);
  });
});

describe("dayKey", () => {
  test("returns YYYY-MM-DD for an epoch-milliseconds instant", () => {
    assert.equal(dayKey(Date.parse("2026-01-15T10:00:00Z")), "2026-01-15");
  });

  test("accepts an ISO string as well", () => {
    assert.equal(dayKey("2026-01-15T10:00:00Z"), "2026-01-15");
  });

  test("last and first millisecond of a UTC day fall on different days", () => {
    assert.equal(dayKey("2026-01-15T23:59:59.999Z"), "2026-01-15");
    assert.equal(dayKey("2026-01-16T00:00:00.000Z"), "2026-01-16");
  });

  // Characterises current behaviour: the day is the UTC calendar day, not the Kyiv one.
  // 00:30 Kyiv on 16 Jan (UTC+2) is 22:30 UTC on 15 Jan and is booked on the 15th.
  test("uses the UTC calendar day (not Kyiv local day)", () => {
    assert.equal(dayKey("2026-01-16T00:30:00+02:00"), "2026-01-15");
    assert.equal(dayKey("2026-07-16T02:59:00+03:00"), "2026-07-15");
    assert.equal(dayKey("2026-07-16T03:00:00+03:00"), "2026-07-16");
  });

  test("throws RangeError for an invalid instant", () => {
    assert.throws(() => dayKey(Number.NaN), RangeError);
    assert.throws(() => dayKey("not a date"), RangeError);
  });
});

describe("createDayCap", () => {
  const MORNING = Date.parse("2026-01-15T08:00:00Z");
  const EVENING = Date.parse("2026-01-15T20:00:00Z");
  const NEXT_DAY = Date.parse("2026-01-16T08:00:00Z");

  test("defaults the limit to DAY_CAP and exposes it", () => {
    assert.equal(createDayCap().limit, DAY_CAP);
    assert.equal(createDayCap({}).limit, DAY_CAP);
  });

  test("accepts a custom limit", () => {
    const cap = createDayCap({ limit: 5000 });
    assert.equal(cap.limit, 5000);
    assert.equal(cap.remaining("r1", MORNING), 5000);
  });

  test("a rider with no charges has the full limit remaining and 0 charged", () => {
    const cap = createDayCap();
    assert.equal(cap.remaining("r1", MORNING), DAY_CAP);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 0);
  });

  test("record reduces what remains on the same day", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 12000);
    assert.equal(cap.remaining("r1", MORNING), 18000);
    assert.equal(cap.remaining("r1", EVENING), 18000);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 12000);
  });

  test("records on the same day accumulate", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 10000);
    cap.record("r1", EVENING, 7500);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 17500);
    assert.equal(cap.remaining("r1", MORNING), 12500);
  });

  test("remaining never goes below zero when more than the limit was recorded", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 45000);
    assert.equal(cap.remaining("r1", MORNING), 0);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 45000);
  });

  test("remaining is exactly zero when the limit is reached", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, DAY_CAP);
    assert.equal(cap.remaining("r1", EVENING), 0);
  });

  test("recording zero changes nothing", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 0);
    assert.equal(cap.remaining("r1", MORNING), DAY_CAP);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 0);
  });

  test("riders are tracked separately", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 20000);
    assert.equal(cap.remaining("r2", MORNING), DAY_CAP);
    assert.equal(cap.chargedOn("r2", "2026-01-15"), 0);
  });

  test("days are tracked separately", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 30000);
    assert.equal(cap.remaining("r1", NEXT_DAY), DAY_CAP);
    assert.equal(cap.chargedOn("r1", "2026-01-16"), 0);
  });

  test("the day boundary is midnight UTC (current behaviour)", () => {
    const cap = createDayCap();
    // 01:00 Kyiv on 16 Jan = 23:00 UTC on 15 Jan → same ledger day as the morning ride.
    cap.record("r1", MORNING, 10000);
    cap.record("r1", Date.parse("2026-01-16T01:00:00+02:00"), 5000);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 15000);
    assert.equal(cap.chargedOn("r1", "2026-01-16"), 0);
  });

  test("separate ledgers do not share state", () => {
    const a = createDayCap();
    const b = createDayCap();
    a.record("r1", MORNING, 25000);
    assert.equal(b.remaining("r1", MORNING), DAY_CAP);
  });

  test("chargedOn takes the day string, not an instant", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 1000);
    assert.equal(cap.chargedOn("r1", MORNING), 0);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 1000);
  });
});
