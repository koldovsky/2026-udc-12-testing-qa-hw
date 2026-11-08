// Unit tests for app/src/day-cap.js — the daily cap ledger (T6).
// Written against the code as it is: every assertion records observed behaviour.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { DAY_CAP, dayKey, createDayCap } from "../../app/src/day-cap.js";

const JAN_15 = Date.parse("2026-01-15T10:00:00Z");
const JAN_16 = Date.parse("2026-01-16T10:00:00Z");

describe("DAY_CAP", () => {
  it("is 30000 kopecks (300.00 UAH)", () => {
    assert.equal(DAY_CAP, 30000);
  });
});

describe("dayKey", () => {
  it("returns the YYYY-MM-DD part of the instant", () => {
    assert.equal(dayKey(Date.parse("2026-01-15T10:00:00Z")), "2026-01-15");
  });

  it("accepts an epoch-millisecond number, an ISO string and a Date alike", () => {
    const ms = Date.parse("2026-03-07T08:30:00Z");
    assert.equal(dayKey(ms), "2026-03-07");
    assert.equal(dayKey("2026-03-07T08:30:00Z"), "2026-03-07");
    assert.equal(dayKey(new Date(ms)), "2026-03-07");
  });

  it("resolves an offset to the same instant before taking the day", () => {
    // 2026-01-15T01:30+03:00 is 2026-01-14T22:30Z.
    assert.equal(dayKey("2026-01-15T01:30:00+03:00"), "2026-01-14");
  });

  it("keys days in UTC, not in Kyiv wall-clock time", () => {
    // 22:30Z in winter is already 00:30 of the next day in Kyiv (UTC+2),
    // yet the ledger books the ride on the UTC day.
    assert.equal(dayKey(Date.parse("2026-01-15T22:30:00Z")), "2026-01-15");
    // Summer (UTC+3): 21:30Z is 00:30 Kyiv of 2026-07-16.
    assert.equal(dayKey(Date.parse("2026-07-15T21:30:00Z")), "2026-07-15");
  });

  it("treats midnight UTC as the start of a new day", () => {
    assert.equal(dayKey(Date.parse("2026-01-15T23:59:59.999Z")), "2026-01-15");
    assert.equal(dayKey(Date.parse("2026-01-16T00:00:00.000Z")), "2026-01-16");
  });

  it("throws RangeError on an unparsable instant", () => {
    assert.throws(() => dayKey("not-a-date"), RangeError);
    assert.throws(() => dayKey(Number.NaN), RangeError);
  });
});

describe("createDayCap — limit", () => {
  it("defaults to DAY_CAP", () => {
    assert.equal(createDayCap().limit, DAY_CAP);
    assert.equal(createDayCap({}).limit, DAY_CAP);
  });

  it("can be overridden", () => {
    assert.equal(createDayCap({ limit: 5000 }).limit, 5000);
  });

  it("accepts a zero limit (nothing may be charged)", () => {
    const ledger = createDayCap({ limit: 0 });
    assert.equal(ledger.limit, 0);
    assert.equal(ledger.remaining("r1", JAN_15), 0);
  });
});

describe("createDayCap — remaining", () => {
  it("starts at the full limit for an unseen rider", () => {
    assert.equal(createDayCap().remaining("r1", JAN_15), DAY_CAP);
    assert.equal(createDayCap({ limit: 5000 }).remaining("r1", JAN_15), 5000);
  });

  it("shrinks by what has been recorded on that day", () => {
    const ledger = createDayCap();
    ledger.record("r1", JAN_15, 12000);
    assert.equal(ledger.remaining("r1", JAN_15), 18000);
  });

  it("is zero once the limit is reached exactly", () => {
    const ledger = createDayCap({ limit: 5000 });
    ledger.record("r1", JAN_15, 5000);
    assert.equal(ledger.remaining("r1", JAN_15), 0);
  });

  it("clamps at zero instead of going negative when over-recorded", () => {
    const ledger = createDayCap({ limit: 5000 });
    ledger.record("r1", JAN_15, 9999);
    assert.equal(ledger.remaining("r1", JAN_15), 0);
  });

  it("is unaffected by a recording of zero", () => {
    const ledger = createDayCap();
    ledger.record("r1", JAN_15, 0);
    assert.equal(ledger.remaining("r1", JAN_15), DAY_CAP);
  });

  it("reads the same bucket for any instant on the same UTC day", () => {
    const ledger = createDayCap();
    ledger.record("r1", Date.parse("2026-01-15T00:00:00Z"), 10000);
    assert.equal(ledger.remaining("r1", Date.parse("2026-01-15T23:59:00Z")), 20000);
  });
});

describe("createDayCap — record", () => {
  it("accumulates several charges on the same day", () => {
    const ledger = createDayCap();
    ledger.record("r1", JAN_15, 1000);
    ledger.record("r1", JAN_15, 2500);
    ledger.record("r1", JAN_15, 500);
    assert.equal(ledger.chargedOn("r1", "2026-01-15"), 4000);
    assert.equal(ledger.remaining("r1", JAN_15), 26000);
  });

  it("keeps riders apart", () => {
    const ledger = createDayCap();
    ledger.record("r1", JAN_15, 30000);
    assert.equal(ledger.remaining("r1", JAN_15), 0);
    assert.equal(ledger.remaining("r2", JAN_15), DAY_CAP);
    assert.equal(ledger.chargedOn("r2", "2026-01-15"), 0);
  });

  it("keeps days apart", () => {
    const ledger = createDayCap();
    ledger.record("r1", JAN_15, 30000);
    assert.equal(ledger.remaining("r1", JAN_16), DAY_CAP);
    assert.equal(ledger.chargedOn("r1", "2026-01-15"), 30000);
    assert.equal(ledger.chargedOn("r1", "2026-01-16"), 0);
  });

  it("keeps ledger instances independent", () => {
    const a = createDayCap();
    const b = createDayCap();
    a.record("r1", JAN_15, 7000);
    assert.equal(a.chargedOn("r1", "2026-01-15"), 7000);
    assert.equal(b.chargedOn("r1", "2026-01-15"), 0);
  });

  it("accepts rider ids of any shape, including numbers", () => {
    const ledger = createDayCap();
    ledger.record(42, JAN_15, 1500);
    assert.equal(ledger.remaining(42, JAN_15), 28500);
    assert.equal(ledger.chargedOn("42", "2026-01-15"), 1500, "ids are stringified into the key");
  });
});

describe("createDayCap — chargedOn", () => {
  it("takes the day as a YYYY-MM-DD string, not an instant", () => {
    const ledger = createDayCap();
    ledger.record("r1", JAN_15, 3000);
    assert.equal(ledger.chargedOn("r1", "2026-01-15"), 3000);
    assert.equal(ledger.chargedOn("r1", JAN_15), 0, "an instant is not a day key");
  });

  it("returns 0 for a rider or day that was never recorded", () => {
    const ledger = createDayCap();
    assert.equal(ledger.chargedOn("nobody", "2026-01-15"), 0);
    assert.equal(ledger.chargedOn("nobody", "nonsense"), 0);
  });

  it("does not expose Map prototype keys", () => {
    assert.equal(createDayCap().chargedOn("constructor", "toString"), 0);
  });
});

describe("createDayCap — flat string keys", () => {
  it("lets a rider id containing a pipe collide with another rider's day bucket", () => {
    // keyOf builds `${riderId}|${day}`, so "r1|2026-01-15" + "2026-02-02"
    // and "r1" + "2026-01-15|2026-02-02" land on the same entry.
    const ledger = createDayCap();
    ledger.record("r1|2026-01-15", Date.parse("2026-02-02T10:00:00Z"), 777);
    assert.equal(ledger.chargedOn("r1", "2026-01-15|2026-02-02"), 777);
  });
});
