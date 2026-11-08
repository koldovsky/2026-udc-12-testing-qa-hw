// Unit tests for app/src/day-cap.js — node:test + node:assert/strict, no npm deps.

import test, { describe } from "node:test";
import assert from "node:assert/strict";

import { DAY_CAP, createDayCap, dayKey } from "../../app/src/day-cap.js";

describe("DAY_CAP", () => {
  test("the cap is 30000 kopecks", () => {
    assert.equal(DAY_CAP, 30000);
  });
});

describe("dayKey()", () => {
  test("is the UTC calendar date of the pickup", () => {
    assert.equal(dayKey("2026-06-01T10:00:00Z"), "2026-06-01");
    assert.equal(dayKey(Date.parse("2026-06-01T10:00:00Z")), "2026-06-01");
    assert.equal(dayKey(new Date("2026-06-01T10:00:00Z")), "2026-06-01");
  });

  test("the UTC day boundary is what counts, not the Kyiv one", () => {
    // 23:30Z on 1 June is already 02:30 on 2 June in Kyiv, but the ledger books it on 1 June.
    assert.equal(dayKey("2026-06-01T23:30:00Z"), "2026-06-01");
    assert.equal(dayKey("2026-06-02T00:30:00Z"), "2026-06-02");
  });

  test("an offset in the input is resolved to UTC first", () => {
    assert.equal(dayKey("2026-06-02T01:00:00+03:00"), "2026-06-01");
  });

  test("the first and last instant of a UTC day", () => {
    assert.equal(dayKey("2026-06-01T00:00:00Z"), "2026-06-01");
    assert.equal(dayKey("2026-06-01T23:59:59Z"), "2026-06-01");
  });
});

describe("createDayCap()", () => {
  test("starts with the default limit and nothing charged", () => {
    const ledger = createDayCap();
    assert.equal(ledger.limit, DAY_CAP);
    assert.equal(ledger.remaining("R1", "2026-06-01T10:00:00Z"), 30000);
    assert.equal(ledger.chargedOn("R1", "2026-06-01"), 0);
  });

  test("takes a custom limit", () => {
    const ledger = createDayCap({ limit: 5000 });
    assert.equal(ledger.limit, 5000);
    assert.equal(ledger.remaining("R1", "2026-06-01T10:00:00Z"), 5000);
  });

  test("a zero limit leaves nothing to spend", () => {
    const ledger = createDayCap({ limit: 0 });
    assert.equal(ledger.remaining("R1", "2026-06-01T10:00:00Z"), 0);
  });

  test("exposes only limit, remaining, record and chargedOn", () => {
    assert.deepEqual(Object.keys(createDayCap()).sort(), ["chargedOn", "limit", "record", "remaining"]);
  });
});

describe("record() and remaining()", () => {
  test("a charge reduces what is left for that day", () => {
    const ledger = createDayCap();
    ledger.record("R1", "2026-06-01T10:00:00Z", 12000);
    assert.equal(ledger.remaining("R1", "2026-06-01T12:00:00Z"), 18000);
    assert.equal(ledger.chargedOn("R1", "2026-06-01"), 12000);
  });

  test("charges on the same day add up", () => {
    const ledger = createDayCap();
    ledger.record("R1", "2026-06-01T08:00:00Z", 10000);
    ledger.record("R1", "2026-06-01T18:00:00Z", 5000);
    assert.equal(ledger.chargedOn("R1", "2026-06-01"), 15000);
    assert.equal(ledger.remaining("R1", "2026-06-01T20:00:00Z"), 15000);
  });

  test("spending the whole cap leaves nothing", () => {
    const ledger = createDayCap();
    ledger.record("R1", "2026-06-01T08:00:00Z", 30000);
    assert.equal(ledger.remaining("R1", "2026-06-01T09:00:00Z"), 0);
  });

  test("remaining never goes below zero, even if overbooked", () => {
    const ledger = createDayCap();
    ledger.record("R1", "2026-06-01T08:00:00Z", 45000);
    assert.equal(ledger.remaining("R1", "2026-06-01T09:00:00Z"), 0);
    assert.equal(ledger.chargedOn("R1", "2026-06-01"), 45000);
  });

  test("a zero charge changes nothing", () => {
    const ledger = createDayCap();
    ledger.record("R1", "2026-06-01T08:00:00Z", 0);
    assert.equal(ledger.remaining("R1", "2026-06-01T08:00:00Z"), 30000);
    assert.equal(ledger.chargedOn("R1", "2026-06-01"), 0);
  });

  test("days are kept apart", () => {
    const ledger = createDayCap();
    ledger.record("R1", "2026-06-01T10:00:00Z", 30000);
    assert.equal(ledger.remaining("R1", "2026-06-02T10:00:00Z"), 30000);
    assert.equal(ledger.chargedOn("R1", "2026-06-02"), 0);
  });

  test("riders are kept apart", () => {
    const ledger = createDayCap();
    ledger.record("R1", "2026-06-01T10:00:00Z", 30000);
    assert.equal(ledger.remaining("R2", "2026-06-01T10:00:00Z"), 30000);
    assert.equal(ledger.chargedOn("R2", "2026-06-01"), 0);
  });

  test("a late-evening charge is booked on the UTC day, which remaining() agrees with", () => {
    const ledger = createDayCap();
    ledger.record("R1", "2026-06-01T23:30:00Z", 30000);
    assert.equal(ledger.chargedOn("R1", "2026-06-01"), 30000);
    // Same UTC day, 20 minutes later — and already the next day in Kyiv.
    assert.equal(ledger.remaining("R1", "2026-06-01T23:50:00Z"), 0);
    assert.equal(ledger.remaining("R1", "2026-06-02T00:10:00Z"), 30000);
  });

  test("a custom limit is what remaining() counts down from", () => {
    const ledger = createDayCap({ limit: 5000 });
    ledger.record("R1", "2026-06-01T10:00:00Z", 2000);
    assert.equal(ledger.remaining("R1", "2026-06-01T10:00:00Z"), 3000);
  });

  test("the pickup instant may be given in any accepted form", () => {
    const ledger = createDayCap();
    ledger.record("R1", Date.parse("2026-06-01T10:00:00Z"), 1000);
    ledger.record("R1", new Date("2026-06-01T11:00:00Z"), 1000);
    ledger.record("R1", "2026-06-01T12:00:00Z", 1000);
    assert.equal(ledger.chargedOn("R1", "2026-06-01"), 3000);
  });

  test("record() returns nothing", () => {
    assert.equal(createDayCap().record("R1", "2026-06-01T10:00:00Z", 100), undefined);
  });
});

describe("chargedOn()", () => {
  test("an unknown rider or day is zero, not undefined", () => {
    const ledger = createDayCap();
    assert.equal(ledger.chargedOn("nobody", "2026-06-01"), 0);
    assert.equal(ledger.chargedOn("R1", "1999-01-01"), 0);
  });

  test("takes the day as a plain YYYY-MM-DD string, not an instant", () => {
    const ledger = createDayCap();
    ledger.record("R1", "2026-06-01T10:00:00Z", 2500);
    assert.equal(ledger.chargedOn("R1", "2026-06-01"), 2500);
    assert.equal(ledger.chargedOn("R1", "2026-06-01T10:00:00Z"), 0);
  });
});

describe("ledgers are independent", () => {
  test("two ledgers do not see each other's charges", () => {
    const first = createDayCap();
    const second = createDayCap();
    first.record("R1", "2026-06-01T10:00:00Z", 30000);
    assert.equal(first.remaining("R1", "2026-06-01T10:00:00Z"), 0);
    assert.equal(second.remaining("R1", "2026-06-01T10:00:00Z"), 30000);
  });
});
