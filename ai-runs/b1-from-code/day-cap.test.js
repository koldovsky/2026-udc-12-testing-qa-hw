// Unit tests for app/src/day-cap.js — the per-rider, per-day ledger of time charges (T6).
// Written from the code only; they describe its current behaviour.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DAY_CAP, createDayCap, dayKey } from "../../app/src/day-cap.js";

describe("DAY_CAP", () => {
  test("is 300 UAH in kopecks", () => {
    assert.equal(DAY_CAP, 30000);
  });
});

describe("dayKey", () => {
  test("returns the YYYY-MM-DD date of an ISO string", () => {
    assert.equal(dayKey("2026-03-10T10:00:00Z"), "2026-03-10");
  });

  test("accepts epoch milliseconds and Date objects", () => {
    const ms = Date.parse("2026-03-10T10:00:00Z");
    assert.equal(dayKey(ms), "2026-03-10");
    assert.equal(dayKey(new Date(ms)), "2026-03-10");
  });

  test("normalises an offset to the same instant", () => {
    assert.equal(dayKey("2026-03-10T12:00:00+02:00"), "2026-03-10");
  });

  // NOTE: the key is the UTC calendar date, not the Kyiv one (tariff.js uses Kyiv time for the
  // night discount). A ride picked up at 01:30 Kyiv time is booked on the previous day.
  test("uses the UTC calendar date (current behaviour)", () => {
    assert.equal(dayKey("2026-01-14T23:30:00Z"), "2026-01-14"); // 01:30 on 15 Jan in Kyiv
    assert.equal(dayKey("2026-01-15T01:30:00+02:00"), "2026-01-14");
    assert.equal(dayKey("2026-01-15T00:00:00Z"), "2026-01-15");
  });

  test("throws on an invalid date", () => {
    assert.throws(() => dayKey("not a date"), RangeError);
  });
});

describe("createDayCap", () => {
  const MORNING = "2026-03-10T08:00:00Z";
  const EVENING = "2026-03-10T18:00:00Z";
  const NEXT_DAY = "2026-03-11T08:00:00Z";

  test("defaults the limit to DAY_CAP", () => {
    const cap = createDayCap();
    assert.equal(cap.limit, DAY_CAP);
    assert.equal(cap.remaining("r1", MORNING), DAY_CAP);
  });

  test("takes a custom limit", () => {
    const cap = createDayCap({ limit: 1000 });
    assert.equal(cap.limit, 1000);
    assert.equal(cap.remaining("r1", MORNING), 1000);
  });

  test("an empty options object keeps the default limit", () => {
    assert.equal(createDayCap({}).limit, DAY_CAP);
  });

  test("record reduces what remains for that rider on that day", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 12000);
    assert.equal(cap.remaining("r1", MORNING), 18000);
  });

  test("records on the same day accumulate, whatever the time of day", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 10000);
    cap.record("r1", EVENING, 5000);
    assert.equal(cap.chargedOn("r1", "2026-03-10"), 15000);
    assert.equal(cap.remaining("r1", EVENING), 15000);
  });

  test("remaining never goes below zero", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 25000);
    cap.record("r1", MORNING, 25000);
    assert.equal(cap.chargedOn("r1", "2026-03-10"), 50000);
    assert.equal(cap.remaining("r1", MORNING), 0);
  });

  test("remaining is exactly zero when the limit is reached", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, DAY_CAP);
    assert.equal(cap.remaining("r1", MORNING), 0);
  });

  test("riders are tracked separately", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 20000);
    assert.equal(cap.remaining("r2", MORNING), DAY_CAP);
    assert.equal(cap.chargedOn("r2", "2026-03-10"), 0);
  });

  test("a new day starts from the full limit", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, DAY_CAP);
    assert.equal(cap.remaining("r1", NEXT_DAY), DAY_CAP);
    assert.equal(cap.chargedOn("r1", "2026-03-11"), 0);
  });

  test("recording zero is harmless", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 0);
    assert.equal(cap.chargedOn("r1", "2026-03-10"), 0);
    assert.equal(cap.remaining("r1", MORNING), DAY_CAP);
  });

  test("chargedOn is 0 for an unknown rider or day", () => {
    const cap = createDayCap();
    assert.equal(cap.chargedOn("nobody", "2026-03-10"), 0);
  });

  test("chargedOn takes the day as a YYYY-MM-DD key, not an instant", () => {
    const cap = createDayCap();
    cap.record("r1", MORNING, 1000);
    assert.equal(cap.chargedOn("r1", "2026-03-10"), 1000);
    assert.equal(cap.chargedOn("r1", MORNING), 0);
  });

  test("instants on either side of UTC midnight land on different days", () => {
    const cap = createDayCap();
    cap.record("r1", "2026-01-14T23:30:00Z", 20000); // 01:30, 15 Jan in Kyiv
    cap.record("r1", "2026-01-15T08:00:00Z", 20000);
    assert.equal(cap.chargedOn("r1", "2026-01-14"), 20000);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 20000);
  });

  test("ledgers do not share state", () => {
    const a = createDayCap();
    const b = createDayCap();
    a.record("r1", MORNING, 20000);
    assert.equal(b.remaining("r1", MORNING), DAY_CAP);
  });

  test("a custom limit caps remaining the same way", () => {
    const cap = createDayCap({ limit: 5000 });
    cap.record("r1", MORNING, 3000);
    assert.equal(cap.remaining("r1", MORNING), 2000);
    cap.record("r1", MORNING, 3000);
    assert.equal(cap.remaining("r1", MORNING), 0);
  });
});
