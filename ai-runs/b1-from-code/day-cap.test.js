// Unit tests for app/src/day-cap.js. Derived from the code only: the spec was not consulted.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DAY_CAP, createDayCap, dayKey } from "../../app/src/day-cap.js";

const NOON = "2026-06-15T12:00:00Z";
const NEXT_DAY = "2026-06-16T12:00:00Z";

describe("DAY_CAP", () => {
  it("is 300 UAH in kopecks", () => {
    assert.equal(DAY_CAP, 30000);
  });
});

describe("dayKey", () => {
  it("accepts an ISO string, epoch milliseconds and a Date", () => {
    const ms = Date.parse(NOON);
    assert.equal(dayKey(NOON), "2026-06-15");
    assert.equal(dayKey(ms), "2026-06-15");
    assert.equal(dayKey(new Date(ms)), "2026-06-15");
  });

  it("throws RangeError on an invalid instant", () => {
    assert.throws(() => dayKey("not a date"), RangeError);
    assert.throws(() => dayKey(NaN), RangeError);
  });
});

describe("createDayCap", () => {
  it("uses DAY_CAP as the default limit", () => {
    const cap = createDayCap();
    assert.equal(cap.limit, 30000);
    assert.equal(cap.remaining("r1", NOON), 30000);
  });

  it("takes a custom limit, including zero", () => {
    assert.equal(createDayCap({ limit: 5000 }).remaining("r1", NOON), 5000);
    assert.equal(createDayCap({ limit: 0 }).remaining("r1", NOON), 0);
  });

  it("subtracts recorded charges from what remains", () => {
    const cap = createDayCap();
    cap.record("r1", NOON, 10000);
    assert.equal(cap.remaining("r1", NOON), 20000);
  });

  it("adds up several charges on one day", () => {
    const cap = createDayCap();
    cap.record("r1", "2026-06-15T08:00:00Z", 10000);
    cap.record("r1", "2026-06-15T18:00:00Z", 2500);
    assert.equal(cap.chargedOn("r1", "2026-06-15"), 12500);
    assert.equal(cap.remaining("r1", NOON), 17500);
  });

  it("leaves nothing remaining at exactly the limit", () => {
    const cap = createDayCap();
    cap.record("r1", NOON, 30000);
    assert.equal(cap.remaining("r1", NOON), 0);
  });

  it("never reports a negative remainder, but keeps the real sum charged", () => {
    const cap = createDayCap();
    cap.record("r1", NOON, 35000);
    assert.equal(cap.remaining("r1", NOON), 0);
    assert.equal(cap.chargedOn("r1", "2026-06-15"), 35000);
  });

  it("keeps riders apart", () => {
    const cap = createDayCap();
    cap.record("r1", NOON, 10000);
    assert.equal(cap.remaining("r2", NOON), 30000);
    assert.equal(cap.chargedOn("r2", "2026-06-15"), 0);
  });

  it("keeps days apart", () => {
    const cap = createDayCap();
    cap.record("r1", NOON, 10000);
    assert.equal(cap.remaining("r1", NEXT_DAY), 30000);
    assert.equal(cap.chargedOn("r1", "2026-06-16"), 0);
  });

  it("keeps ledgers apart", () => {
    const first = createDayCap();
    const second = createDayCap();
    first.record("r1", NOON, 10000);
    assert.equal(second.remaining("r1", NOON), 30000);
  });

  it("reports zero charged for an unknown rider or day", () => {
    assert.equal(createDayCap().chargedOn("nobody", "2026-06-15"), 0);
  });

  it("treats different offsets of one instant as the same day", () => {
    const cap = createDayCap();
    cap.record("r1", "2026-06-15T15:00:00+03:00", 10000);
    assert.equal(cap.remaining("r1", NOON), 20000);
  });
});

// Pins what the code does today, not what it should do. dayKey cuts the day at UTC midnight,
// while tariff.js reads the night hours in Kyiv time. Check against the spec.
describe("unconfirmed: the day boundary is UTC midnight, not Kyiv midnight", () => {
  it("books a pickup at 01:00 Kyiv on the previous calendar date", () => {
    assert.equal(dayKey("2026-06-15T01:00:00+03:00"), "2026-06-14");
    assert.equal(dayKey("2026-01-15T01:00:00+02:00"), "2026-01-14");
  });

  it("changes the day at 03:00 Kyiv in summer and 02:00 in winter", () => {
    assert.equal(dayKey("2026-06-15T02:59:59+03:00"), "2026-06-14");
    assert.equal(dayKey("2026-06-15T03:00:00+03:00"), "2026-06-15");
    assert.equal(dayKey("2026-01-15T01:59:59+02:00"), "2026-01-14");
    assert.equal(dayKey("2026-01-15T02:00:00+02:00"), "2026-01-15");
  });
});
