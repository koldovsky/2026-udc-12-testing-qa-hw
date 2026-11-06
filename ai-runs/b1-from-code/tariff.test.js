// Unit tests for app/src/tariff.js. Derived from the code only: the spec was not consulted.
// Expected amounts are literal kopecks worked out by hand, so a changed constant fails a test.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDayCap } from "../../app/src/day-cap.js";
import { QuoteError, RATES, discount, quote } from "../../app/src/tariff.js";

const DAYTIME = "2026-06-15T12:00:00+03:00";
const NIGHT = "2026-06-15T02:00:00+03:00";
const IN_ZONE = "S01";
const OUT_OF_ZONE = "X01";

const standard = { type: "standard" };
const reduced = { type: "reduced" };
const subscriber = { type: "subscriber" };
const concession = { type: "subscriber", concession: true };

function rideOfSeconds(seconds, { pickupAt = DAYTIME, bike = "classic", returnStation = IN_ZONE } = {}) {
  const returnAt = new Date(Date.parse(pickupAt) + seconds * 1000).toISOString();
  return { pickupAt, returnAt, bike, returnStation };
}

function ride(minutes, options) {
  return rideOfSeconds(minutes * 60, options);
}

function assertQuoteError(fn, message) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof QuoteError);
    assert.ok(err instanceof Error);
    assert.equal(err.name, "QuoteError");
    assert.match(err.message, message);
    return true;
  });
}

describe("RATES", () => {
  it("cannot be changed", () => {
    assert.ok(Object.isFrozen(RATES));
  });
});

describe("discount", () => {
  it("takes the percentage off a round amount", () => {
    assert.equal(discount(2500, 50), 1250);
    assert.equal(discount(2500, 30), 750);
    assert.equal(discount(4000, 20), 800);
  });

  it("rounds what is left to pay down, so the discount rounds up", () => {
    assert.equal(discount(2501, 50), 1251);
    assert.equal(discount(999, 30), 300);
    assert.equal(discount(1, 50), 1);
  });

  it("handles 0 % and 100 %", () => {
    assert.equal(discount(2500, 0), 0);
    assert.equal(discount(2500, 100), 2500);
  });

  it("is zero on a zero amount", () => {
    assert.equal(discount(0, 30), 0);
  });
});

describe("quote: time charge", () => {
  it("returns the itemised result for a plain ride", () => {
    assert.deepEqual(quote(ride(30), standard), {
      minutes: 30,
      timeCharge: 2500,
      discounts: [],
      fees: [],
      total: 2500,
    });
  });

  it("charges an e-bike 40 UAH per block", () => {
    const result = quote(ride(30, { bike: "ebike" }), standard);
    assert.equal(result.timeCharge, 4000);
    assert.equal(result.total, 4000);
  });

  for (const [minutes, timeCharge] of [
    [0, 0],
    [1, 0],
    [2, 2500],
    [29, 2500],
    [30, 2500],
    [31, 5000],
    [60, 5000],
    [61, 7500],
  ]) {
    it(`charges ${timeCharge} for ${minutes} min on a classic bike`, () => {
      assert.equal(quote(ride(minutes), standard).timeCharge, timeCharge);
    });
  }

  for (const [seconds, minutes] of [
    [89, 1],
    [90, 2],
    [30 * 60 + 29, 30],
    [30 * 60 + 30, 31],
  ]) {
    it(`rounds ${seconds} s to ${minutes} min`, () => {
      assert.equal(quote(rideOfSeconds(seconds), standard).minutes, minutes);
    });
  }

  it("makes the seconds decide between free and paid", () => {
    assert.equal(quote(rideOfSeconds(89), standard).total, 0);
    assert.equal(quote(rideOfSeconds(90), standard).total, 2500);
  });

  it("measures a ride whose two ends use different offsets", () => {
    const result = quote(
      { pickupAt: "2026-06-15T12:00:00+03:00", returnAt: "2026-06-15T09:30:00Z", bike: "classic", returnStation: IN_ZONE },
      standard,
    );
    assert.equal(result.minutes, 30);
  });
});

describe("quote: subscription", () => {
  it("makes the first 45 minutes free", () => {
    assert.deepEqual(quote(ride(45), subscriber), {
      minutes: 45,
      timeCharge: 5000,
      discounts: [{ code: "subscription", amount: 5000 }],
      fees: [],
      total: 0,
    });
  });

  it("bills blocks only for the time past 45 minutes", () => {
    assert.equal(quote(ride(46), subscriber).total, 2500);
    assert.equal(quote(ride(75), subscriber).total, 2500);
    assert.equal(quote(ride(76), subscriber).total, 5000);
  });

  it("takes 20 % off the blocks past 45 minutes on an e-bike", () => {
    const result = quote(ride(46, { bike: "ebike" }), subscriber);
    assert.equal(result.timeCharge, 8000);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 4800 }]);
    assert.equal(result.total, 3200);
  });

  it("gives no 20 % on a classic bike", () => {
    assert.deepEqual(quote(ride(46), subscriber).discounts, [{ code: "subscription", amount: 2500 }]);
  });

  it("lists no discount on a free-start ride", () => {
    assert.deepEqual(quote(ride(1), subscriber).discounts, []);
  });
});

describe("quote: reduced fare", () => {
  it("halves the time charge", () => {
    const result = quote(ride(30), reduced);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 1250 }]);
    assert.equal(result.total, 1250);
  });

  it("halves an e-bike ride too", () => {
    assert.equal(quote(ride(30, { bike: "ebike" }), reduced).total, 2000);
  });

  it("halves the out-of-zone fee", () => {
    const result = quote(ride(30, { returnStation: OUT_OF_ZONE }), reduced);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(result.total, 8750);
  });

  it("halves the unreturned fee", () => {
    const result = quote(ride(1441), reduced);
    assert.deepEqual(result.fees, [{ code: "unreturned", amount: 100000 }]);
    assert.equal(result.total, 130000);
  });
});

describe("quote: subscriber with a concession", () => {
  it("gets the subscription when it is cheaper", () => {
    const result = quote(ride(30), concession);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 0);
  });

  it("gets the reduced fare when it is cheaper", () => {
    const result = quote(ride(300), concession);
    assert.equal(result.timeCharge, 25000);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 12500 }]);
    assert.equal(result.total, 12500);
  });

  it("compares against the e-bike subscription price", () => {
    const result = quote(ride(300, { bike: "ebike" }), concession);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 20000 }]);
    assert.equal(result.total, 20000);
  });

  it("never combines the two plans", () => {
    assert.equal(quote(ride(300), concession).discounts.length, 1);
  });

  it("has its fees halved when the reduced fare wins", () => {
    const result = quote(ride(300, { returnStation: OUT_OF_ZONE }), concession);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(result.total, 20000);
  });

  it("needs concession to be exactly true", () => {
    const result = quote(ride(300), { type: "subscriber", concession: "true" });
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
  });

  it("ignores concession on a standard rider", () => {
    const result = quote(ride(300), { type: "standard", concession: true });
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 25000);
  });
});

describe("quote: night discount", () => {
  it("takes 30 % off a night ride", () => {
    const result = quote(ride(30, { pickupAt: NIGHT }), standard);
    assert.deepEqual(result.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(result.total, 1750);
  });

  for (const pickupAt of ["2026-06-15T00:00:00+03:00", "2026-06-15T05:59:00+03:00"]) {
    it(`applies to a pickup at ${pickupAt}`, () => {
      assert.equal(quote(ride(30, { pickupAt }), standard).total, 1750);
    });
  }

  for (const pickupAt of ["2026-06-15T06:00:00+03:00", "2026-06-14T23:59:00+03:00"]) {
    it(`does not apply to a pickup at ${pickupAt}`, () => {
      assert.deepEqual(quote(ride(30, { pickupAt }), standard).discounts, []);
    });
  }

  it("reads the hour in Kyiv, whatever offset the pickup is written in", () => {
    assert.equal(quote(ride(30, { pickupAt: "2026-06-14T23:00:00Z" }), standard).total, 1750);
    assert.equal(quote(ride(30, { pickupAt: "2026-06-15T12:00:00+10:00" }), standard).total, 1750);
    assert.equal(quote(ride(30, { pickupAt: "2026-06-15T12:00:00+09:00" }), standard).total, 2500);
    assert.equal(quote(ride(30, { pickupAt: "2026-06-15T03:00:00-05:00" }), standard).total, 2500);
  });

  it("follows daylight saving: 03:30 UTC is night in winter but not in summer", () => {
    assert.equal(quote(ride(30, { pickupAt: "2026-01-15T03:30:00Z" }), standard).total, 1750);
    assert.equal(quote(ride(30, { pickupAt: "2026-06-15T03:30:00Z" }), standard).total, 2500);
  });

  it("depends on the pickup alone", () => {
    assert.equal(quote(ride(300, { pickupAt: "2026-06-15T05:00:00+03:00" }), standard).discounts[0].code, "night");
    assert.deepEqual(quote(ride(300, { pickupAt: "2026-06-14T23:30:00+03:00" }), standard).discounts, []);
  });

  it("applies after the reduced fare, on what is left", () => {
    const result = quote(ride(30, { pickupAt: NIGHT }), reduced);
    assert.deepEqual(result.discounts, [
      { code: "reduced", amount: 1250 },
      { code: "night", amount: 375 },
    ]);
    assert.equal(result.total, 875);
  });

  it("applies after the subscription, on what is left", () => {
    const result = quote(ride(46, { pickupAt: NIGHT, bike: "ebike" }), subscriber);
    assert.deepEqual(result.discounts, [
      { code: "subscription", amount: 4800 },
      { code: "night", amount: 960 },
    ]);
    assert.equal(result.total, 2240);
  });

  it("is not listed when nothing is left to discount", () => {
    assert.deepEqual(quote(ride(1, { pickupAt: NIGHT }), standard).discounts, []);
    assert.deepEqual(quote(ride(45, { pickupAt: NIGHT }), subscriber).discounts, [{ code: "subscription", amount: 5000 }]);
  });

  it("does not touch fees", () => {
    const result = quote(ride(30, { pickupAt: NIGHT, returnStation: OUT_OF_ZONE }), standard);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 16750);
  });
});

describe("quote: fees", () => {
  it("adds nothing for a return inside the zone", () => {
    assert.deepEqual(quote(ride(30), standard).fees, []);
  });

  it("adds 150 UAH for a return outside the zone", () => {
    const result = quote(ride(30, { returnStation: OUT_OF_ZONE }), standard);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 17500);
  });

  it("charges the out-of-zone fee on a free ride as well", () => {
    assert.equal(quote(ride(1, { returnStation: OUT_OF_ZONE }), standard).total, 15000);
    assert.equal(quote(ride(45, { returnStation: OUT_OF_ZONE }), subscriber).total, 15000);
  });

  it("adds no unreturned fee at exactly 24 hours", () => {
    assert.deepEqual(quote(ride(1440), standard).fees, []);
  });

  it("adds 2000 UAH past 24 hours", () => {
    const result = quote(ride(1441), standard);
    assert.deepEqual(result.fees, [{ code: "unreturned", amount: 200000 }]);
    assert.equal(result.total, 230000);
  });

  it("uses the rounded minutes for the 24-hour limit", () => {
    assert.deepEqual(quote(rideOfSeconds(1440 * 60 + 29), standard).fees, []);
    assert.equal(quote(rideOfSeconds(1440 * 60 + 30), standard).fees.length, 1);
  });

  it("lists both fees, out-of-zone first", () => {
    const result = quote(ride(1441, { returnStation: OUT_OF_ZONE }), standard);
    assert.deepEqual(result.fees, [
      { code: "out-of-zone", amount: 15000 },
      { code: "unreturned", amount: 200000 },
    ]);
    assert.equal(result.total, 245000);
  });

  it("asks the given zones for the return station", () => {
    const zones = { zoneOf: (id) => (id === "T1" ? "out" : null) };
    const result = quote(ride(30, { returnStation: "T1" }), standard, { zones });
    assert.equal(result.total, 17500);
  });
});

describe("quote: per-ride cap without a ledger", () => {
  it("leaves a ride at exactly the cap alone", () => {
    const result = quote(ride(360), standard);
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 30000);
  });

  it("cuts a ride above the cap down to 300 UAH", () => {
    const result = quote(ride(361), standard);
    assert.equal(result.timeCharge, 32500);
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(result.total, 30000);
  });

  it("applies after the night discount", () => {
    const result = quote(ride(600, { pickupAt: NIGHT }), standard);
    assert.deepEqual(result.discounts, [
      { code: "night", amount: 15000 },
      { code: "day-cap", amount: 5000 },
    ]);
    assert.equal(result.total, 30000);
  });

  it("does not cap fees", () => {
    const result = quote(ride(1441, { returnStation: OUT_OF_ZONE }), standard);
    assert.equal(result.discounts.at(-1).amount, 92500);
    assert.equal(result.total, 30000 + 15000 + 200000);
  });

  it("does not carry over between rides", () => {
    assert.equal(quote(ride(360), standard).total, 30000);
    assert.equal(quote(ride(360), standard).total, 30000);
  });
});

describe("quote: with a day-cap ledger", () => {
  const rider = { type: "standard", id: "r1" };

  it("books the ride on its pickup day", () => {
    const dayCap = createDayCap();
    quote(ride(30), rider, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-06-15"), 2500);
  });

  it("books the time charge after discounts", () => {
    const dayCap = createDayCap();
    quote(ride(30), { type: "reduced", id: "r1" }, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-06-15"), 1250);
  });

  it("books no fees", () => {
    const dayCap = createDayCap();
    const result = quote(ride(30, { returnStation: OUT_OF_ZONE }), rider, { dayCap });
    assert.equal(result.total, 17500);
    assert.equal(dayCap.chargedOn("r1", "2026-06-15"), 2500);
  });

  it("cuts the ride that crosses the limit, then bills nothing more", () => {
    const dayCap = createDayCap();
    assert.equal(quote(ride(240), rider, { dayCap }).total, 20000);

    const second = quote(ride(240), rider, { dayCap });
    assert.deepEqual(second.discounts, [{ code: "day-cap", amount: 10000 }]);
    assert.equal(second.total, 10000);

    const third = quote(ride(30), rider, { dayCap });
    assert.deepEqual(third.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(third.total, 0);

    assert.equal(dayCap.chargedOn("r1", "2026-06-15"), 30000);
  });

  it("still charges fees once the cap is used up", () => {
    const dayCap = createDayCap();
    quote(ride(360), rider, { dayCap });
    assert.equal(quote(ride(30, { returnStation: OUT_OF_ZONE }), rider, { dayCap }).total, 15000);
  });

  it("respects the ledger's own limit", () => {
    const dayCap = createDayCap({ limit: 4000 });
    const result = quote(ride(60), rider, { dayCap });
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 1000 }]);
    assert.equal(result.total, 4000);
  });

  it("caps each rider separately", () => {
    const dayCap = createDayCap();
    quote(ride(360), rider, { dayCap });
    assert.equal(quote(ride(30), { type: "standard", id: "r2" }, { dayCap }).total, 2500);
  });

  it("starts afresh the next day", () => {
    const dayCap = createDayCap();
    quote(ride(360), rider, { dayCap });
    assert.equal(quote(ride(30, { pickupAt: "2026-06-16T12:00:00+03:00" }), rider, { dayCap }).total, 2500);
  });

  it("books a ride across midnight wholly on the pickup day", () => {
    const dayCap = createDayCap();
    quote(ride(480, { pickupAt: "2026-06-15T20:00:00+03:00" }), rider, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-06-15"), 30000);
    assert.equal(dayCap.chargedOn("r1", "2026-06-16"), 0);
  });

  it("books zero for a free ride", () => {
    const dayCap = createDayCap();
    quote(ride(45), { type: "subscriber", id: "r1" }, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-06-15"), 0);
  });

  it("requires rider.id", () => {
    assertQuoteError(() => quote(ride(30), standard, { dayCap: createDayCap() }), /rider\.id is required/);
  });

  it("books nothing when the quote is rejected", () => {
    const dayCap = createDayCap();
    assert.throws(() => quote(ride(30, { returnStation: "NOPE" }), rider, { dayCap }), QuoteError);
    assert.equal(dayCap.chargedOn("r1", "2026-06-15"), 0);
  });
});

describe("quote: invalid input", () => {
  const valid = ride(30);

  for (const value of [undefined, null, "ride", 42]) {
    it(`rejects ride = ${value}`, () => {
      assertQuoteError(() => quote(value, standard), /ride is required/);
    });
  }

  for (const value of [
    undefined,
    1781514000000,
    "2026-06-15",
    "2026-06-15T12:00:00",
    "2026-06-15 12:00:00Z",
    "2026-06-15T12:00:00+03",
    "yesterday",
  ]) {
    it(`rejects pickupAt = ${value}`, () => {
      assertQuoteError(() => quote({ ...valid, pickupAt: value }, standard), /pickupAt must be an ISO 8601/);
    });
  }

  it("rejects a malformed returnAt", () => {
    assertQuoteError(() => quote({ ...valid, returnAt: "2026-06-15T12:30:00" }, standard), /returnAt must be an ISO 8601/);
  });

  it("rejects a well-formed but impossible date-time", () => {
    assertQuoteError(() => quote({ ...valid, pickupAt: "2026-13-45T12:00:00Z" }, standard), /pickupAt is not a valid/);
    assertQuoteError(() => quote({ ...valid, returnAt: "2026-06-15T25:00:00Z" }, standard), /returnAt is not a valid/);
  });

  it("accepts date-times without seconds and with fractions", () => {
    const result = quote({ ...valid, pickupAt: "2026-06-15T12:00+03:00", returnAt: "2026-06-15T12:30:00.000+03:00" }, standard);
    assert.equal(result.minutes, 30);
  });

  it("rejects a return before the pickup", () => {
    assertQuoteError(() => quote(ride(-1), standard), /returnAt is before pickupAt/);
  });

  for (const bike of [undefined, "tandem", "toString", "constructor"]) {
    it(`rejects bike = ${bike}`, () => {
      assertQuoteError(() => quote({ ...valid, bike }, standard), /unknown bike type/);
    });
  }

  for (const returnStation of [undefined, "S99", "toString"]) {
    it(`rejects returnStation = ${returnStation}`, () => {
      assertQuoteError(() => quote({ ...valid, returnStation }, standard), /unknown station/);
    });
  }

  for (const rider of [undefined, null, {}, { type: "vip" }]) {
    it(`rejects rider = ${JSON.stringify(rider)}`, () => {
      assertQuoteError(() => quote(valid, rider), /unknown rider type/);
    });
  }
});

// Pins what the code does today, not what it should do. Each of these looks like it could be a
// defect, and the code alone cannot settle it. Check against the spec before relying on them.
describe("unconfirmed: fee halving depends on which plan won", () => {
  it("a reduced rider pays the full fee on a free-start ride", () => {
    const result = quote(ride(1, { returnStation: OUT_OF_ZONE }), reduced);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 15000);
  });

  it("a concession subscriber pays the full fee when the subscription wins", () => {
    const result = quote(ride(30, { returnStation: OUT_OF_ZONE }), concession);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 15000); // the reduced fare would come to 1250 + 7500 = 8750
  });

  it("a tie between the plans goes to the subscription, so the fee stays full", () => {
    const result = quote(ride(60, { returnStation: OUT_OF_ZONE }), concession);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 17500); // the reduced fare would come to 2500 + 7500 = 10000
  });
});

describe("unconfirmed: the ledger's day is the UTC day, the night hours are Kyiv time", () => {
  const rider = { type: "standard", id: "r1" };

  it("books a 01:00 Kyiv pickup on the previous date", () => {
    const dayCap = createDayCap();
    quote(ride(30, { pickupAt: "2026-06-15T01:00:00+03:00" }), rider, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-06-14"), 1750);
    assert.equal(dayCap.chargedOn("r1", "2026-06-15"), 0);
  });

  it("gives two separate caps within one Kyiv date", () => {
    const dayCap = createDayCap();
    const early = quote(ride(480, { pickupAt: "2026-06-15T02:00:00+03:00" }), rider, { dayCap });
    const late = quote(ride(240, { pickupAt: "2026-06-15T12:00:00+03:00" }), rider, { dayCap });
    assert.equal(early.total, 28000);
    assert.equal(late.total, 20000);
  });

  it("shares one cap between two Kyiv dates", () => {
    const dayCap = createDayCap();
    quote(ride(360, { pickupAt: "2026-06-14T23:30:00+03:00" }), rider, { dayCap });
    const next = quote(ride(30, { pickupAt: "2026-06-15T01:00:00+03:00" }), rider, { dayCap });
    assert.equal(next.total, 0);
  });
});
