// Unit tests for app/src/tariff.js — pricing a finished ride, in kopecks.
// Written against the code as it is: every assertion records observed behaviour.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  quote,
  discount,
  QuoteError,
  RATES,
  BLOCK_MINUTES,
  FREE_START_MINUTES,
  SUBSCRIPTION_FREE_MINUTES,
  SUBSCRIPTION_EBIKE_PERCENT,
  REDUCED_PERCENT,
  NIGHT_PERCENT,
  NIGHT_UNTIL_HOUR,
  OUT_OF_ZONE_FEE,
  UNRETURNED_FEE,
  UNRETURNED_AFTER_MINUTES,
} from "../../app/src/tariff.js";
import { createDayCap, DAY_CAP } from "../../app/src/day-cap.js";
import { createZones } from "../../app/src/zones.js";

// Kyiv is UTC+2 in winter and UTC+3 in summer.
const NOON = "2026-01-15T10:00:00Z"; // 12:00 Kyiv — well outside the night window
const NIGHT = "2026-01-15T03:00:00Z"; // 05:00 Kyiv — inside the night window
const IN_ZONE = "S01";
const OUT_ZONE = "X01";

function plus(pickupAt, minutes) {
  return new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString();
}

function makeRide({
  pickupAt = NOON,
  minutes = 30,
  bike = "classic",
  returnStation = IN_ZONE,
  returnAt,
} = {}) {
  return { pickupAt, returnAt: returnAt ?? plus(pickupAt, minutes), bike, returnStation };
}

const STANDARD = { type: "standard", id: "r-standard" };
const REDUCED = { type: "reduced", id: "r-reduced" };
const SUBSCRIBER = { type: "subscriber", id: "r-subscriber" };
const CONCESSION = { type: "subscriber", concession: true, id: "r-concession" };

describe("exported constants", () => {
  it("hold the tariff numbers the rules are built on", () => {
    assert.deepEqual({ ...RATES }, { classic: 2500, ebike: 4000 });
    assert.equal(BLOCK_MINUTES, 30);
    assert.equal(FREE_START_MINUTES, 2);
    assert.equal(SUBSCRIPTION_FREE_MINUTES, 45);
    assert.equal(SUBSCRIPTION_EBIKE_PERCENT, 20);
    assert.equal(REDUCED_PERCENT, 50);
    assert.equal(NIGHT_PERCENT, 30);
    assert.equal(NIGHT_UNTIL_HOUR, 6);
    assert.equal(OUT_OF_ZONE_FEE, 15000);
    assert.equal(UNRETURNED_FEE, 200000);
    assert.equal(UNRETURNED_AFTER_MINUTES, 1440);
  });

  it("freezes the rate table", () => {
    assert.ok(Object.isFrozen(RATES));
  });
});

describe("discount()", () => {
  it("takes the given percent off the amount", () => {
    assert.equal(discount(2500, 50), 1250);
    assert.equal(discount(10000, 30), 3000);
    assert.equal(discount(4000, 20), 800);
  });

  it("rounds what is left to pay down, so the discount absorbs the remainder (T9)", () => {
    // 50% of 999 is 499.5: the rider pays 499 and the discount is 500.
    assert.equal(discount(999, 50), 500);
    assert.equal(discount(1, 50), 1);
    assert.equal(discount(7, 30), 3); // 7 - floor(4.9) = 3
  });

  it("is 0 at 0 percent and the whole amount at 100 percent", () => {
    assert.equal(discount(12345, 0), 0);
    assert.equal(discount(12345, 100), 12345);
  });

  it("is 0 for a zero amount", () => {
    assert.equal(discount(0, 50), 0);
  });
});

describe("quote — result shape", () => {
  it("itemises minutes, time charge, discounts, fees and total", () => {
    const result = quote(makeRide(), STANDARD);
    assert.deepEqual(result, {
      minutes: 30,
      timeCharge: 2500,
      discounts: [],
      fees: [],
      total: 2500,
    });
  });

  it("totals the time charge less every discount plus every fee", () => {
    const result = quote(makeRide({ minutes: 30, returnStation: OUT_ZONE }), REDUCED);
    const discounted = result.discounts.reduce((sum, d) => sum + d.amount, 0);
    const charged = result.fees.reduce((sum, f) => sum + f.amount, 0);
    assert.equal(result.total, result.timeCharge - discounted + charged);
  });
});

describe("quote — time charge (T3)", () => {
  it("charges nothing under the free start", () => {
    assert.equal(quote(makeRide({ minutes: 0 }), STANDARD).total, 0);
    assert.equal(quote(makeRide({ minutes: 1 }), STANDARD).total, 0);
  });

  it("charges a full block from the second minute on — the free start is strictly under 2 minutes", () => {
    const result = quote(makeRide({ minutes: 2 }), STANDARD);
    assert.equal(result.minutes, 2);
    assert.equal(result.total, 2500);
  });

  it("charges one block up to 30 minutes and a whole block for every started one after", () => {
    assert.equal(quote(makeRide({ minutes: 29 }), STANDARD).total, 2500);
    assert.equal(quote(makeRide({ minutes: 30 }), STANDARD).total, 2500);
    assert.equal(quote(makeRide({ minutes: 31 }), STANDARD).total, 5000);
    assert.equal(quote(makeRide({ minutes: 60 }), STANDARD).total, 5000);
    assert.equal(quote(makeRide({ minutes: 61 }), STANDARD).total, 7500);
  });

  it("charges the e-bike rate for an e-bike", () => {
    assert.equal(quote(makeRide({ minutes: 30, bike: "ebike" }), STANDARD).total, 4000);
    assert.equal(quote(makeRide({ minutes: 90, bike: "ebike" }), STANDARD).total, 12000);
  });

  it("rounds the duration to the nearest minute", () => {
    const pickupAt = NOON;
    // 1 min 29 s rounds down to 1 minute — still inside the free start.
    assert.equal(quote(makeRide({ pickupAt, returnAt: plus(pickupAt, 89 / 60) }), STANDARD).minutes, 1);
    // 1 min 30 s rounds up to 2 minutes — a block is due.
    const up = quote(makeRide({ pickupAt, returnAt: plus(pickupAt, 1.5) }), STANDARD);
    assert.equal(up.minutes, 2);
    assert.equal(up.total, 2500);
    // 30 min 30 s rounds up to 31 minutes — a second block is due.
    assert.equal(quote(makeRide({ pickupAt, returnAt: plus(pickupAt, 30.5) }), STANDARD).total, 5000);
  });

  it("prices a zero-length ride with equal timestamps", () => {
    const result = quote(makeRide({ pickupAt: NOON, returnAt: NOON }), STANDARD);
    assert.equal(result.minutes, 0);
    assert.equal(result.total, 0);
  });
});

describe("quote — standard rider", () => {
  it("gets no fare discount at all", () => {
    const result = quote(makeRide({ minutes: 120 }), STANDARD);
    assert.equal(result.timeCharge, 10000);
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 10000);
  });
});

describe("quote — reduced fare", () => {
  it("halves the time charge", () => {
    const result = quote(makeRide({ minutes: 30 }), REDUCED);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 1250 }]);
    assert.equal(result.total, 1250);
  });

  it("halves the e-bike charge too", () => {
    const result = quote(makeRide({ minutes: 31, bike: "ebike" }), REDUCED);
    assert.equal(result.timeCharge, 8000);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 4000 }]);
    assert.equal(result.total, 4000);
  });

  it("gets no free minutes — the subscription plan is not offered to it", () => {
    const result = quote(makeRide({ minutes: 20 }), REDUCED);
    assert.equal(result.total, 1250);
  });

  it("records no discount line when there is nothing to discount", () => {
    const result = quote(makeRide({ minutes: 1 }), REDUCED);
    assert.equal(result.timeCharge, 0);
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 0);
  });
});

describe("quote — subscriber", () => {
  it("rides the first 45 minutes free", () => {
    const result = quote(makeRide({ minutes: 45 }), SUBSCRIBER);
    assert.equal(result.timeCharge, 5000);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(result.total, 0);
  });

  it("pays by started block for the time past 45 minutes", () => {
    assert.equal(quote(makeRide({ minutes: 46 }), SUBSCRIBER).total, 2500);
    assert.equal(quote(makeRide({ minutes: 75 }), SUBSCRIBER).total, 2500);
    assert.equal(quote(makeRide({ minutes: 76 }), SUBSCRIBER).total, 5000);
  });

  it("gets a further 20% off the e-bike time past the free minutes", () => {
    const result = quote(makeRide({ minutes: 60, bike: "ebike" }), SUBSCRIBER);
    assert.equal(result.timeCharge, 8000);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 4800 }]);
    assert.equal(result.total, 3200, "one block of 4000 less 20%");
  });

  it("rides an e-bike free inside the free minutes", () => {
    assert.equal(quote(makeRide({ minutes: 45, bike: "ebike" }), SUBSCRIBER).total, 0);
  });
});

describe("quote — subscriber with a concession", () => {
  it("is charged by whichever of the two plans leaves less to pay", () => {
    // 120 min classic: subscription saves 2500, the reduced fare saves 5000.
    const result = quote(makeRide({ minutes: 120 }), CONCESSION);
    assert.equal(result.timeCharge, 10000);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 5000 }]);
    assert.equal(result.total, 5000);
  });

  it("keeps the subscription when the two plans tie", () => {
    // 60 min classic: both plans save 2500; the subscription is kept.
    const result = quote(makeRide({ minutes: 60 }), CONCESSION);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 2500);
  });

  it("keeps the subscription when it is the better of the two", () => {
    const result = quote(makeRide({ minutes: 45 }), CONCESSION);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(result.total, 0);
  });

  it("needs concession === true: any other truthy value is ignored", () => {
    const result = quote(makeRide({ minutes: 120 }), { type: "subscriber", concession: "yes", id: "r" });
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 7500);
  });

  it("ignores concession on a standard rider", () => {
    const result = quote(makeRide({ minutes: 30 }), { type: "standard", concession: true, id: "r" });
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 2500);
  });
});

describe("quote — night discount", () => {
  it("takes 30% off a ride picked up before 06:00 Kyiv time", () => {
    const result = quote(makeRide({ pickupAt: NIGHT, minutes: 30 }), STANDARD);
    assert.deepEqual(result.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(result.total, 1750);
  });

  it("stops at 06:00 Kyiv time", () => {
    // Winter, UTC+2: 03:59Z is 05:59 Kyiv, 04:00Z is 06:00 Kyiv.
    assert.equal(quote(makeRide({ pickupAt: "2026-01-15T03:59:00Z" }), STANDARD).total, 1750);
    assert.equal(quote(makeRide({ pickupAt: "2026-01-15T04:00:00Z" }), STANDARD).total, 2500);
  });

  it("follows Kyiv summer time (UTC+3)", () => {
    assert.equal(quote(makeRide({ pickupAt: "2026-07-15T02:59:00Z" }), STANDARD).total, 1750);
    assert.equal(quote(makeRide({ pickupAt: "2026-07-15T03:00:00Z" }), STANDARD).total, 2500);
  });

  it("goes by the pickup, not by the return", () => {
    // Picked up 05:50 Kyiv, returned 06:20 Kyiv — still a night ride.
    assert.equal(quote(makeRide({ pickupAt: "2026-01-15T03:50:00Z", minutes: 30 }), STANDARD).total, 1750);
    // Picked up 06:10 Kyiv — not a night ride even if the previous day was.
    assert.equal(quote(makeRide({ pickupAt: "2026-01-15T04:10:00Z", minutes: 30 }), STANDARD).total, 2500);
  });

  it("honours the offset written in the timestamp", () => {
    // 06:00+03:00 is 03:00Z, i.e. 05:00 Kyiv.
    const result = quote(makeRide({ pickupAt: "2026-01-15T06:00:00+03:00", minutes: 30 }), STANDARD);
    assert.equal(result.total, 1750);
  });

  it("applies to what is left after the fare plan", () => {
    const result = quote(makeRide({ pickupAt: NIGHT, minutes: 30 }), REDUCED);
    assert.deepEqual(result.discounts, [
      { code: "reduced", amount: 1250 },
      { code: "night", amount: 375 },
    ]);
    assert.equal(result.total, 875);
  });

  it("is skipped when the fare plan already leaves nothing to pay", () => {
    const result = quote(makeRide({ pickupAt: NIGHT, minutes: 45 }), SUBSCRIBER);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(result.total, 0);
  });

  it("is skipped on a free start inside the night", () => {
    const result = quote(makeRide({ pickupAt: NIGHT, minutes: 1 }), STANDARD);
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 0);
  });
});

describe("quote — fees", () => {
  it("charges the out-of-zone fee for a return outside the zone", () => {
    const result = quote(makeRide({ minutes: 30, returnStation: OUT_ZONE }), STANDARD);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 17500);
  });

  it("charges no fee for a return inside the zone", () => {
    assert.deepEqual(quote(makeRide({ returnStation: "S08" }), STANDARD).fees, []);
  });

  it("charges the out-of-zone fee even on a free ride", () => {
    const result = quote(makeRide({ minutes: 1, returnStation: OUT_ZONE }), STANDARD);
    assert.equal(result.timeCharge, 0);
    assert.equal(result.total, 15000);
  });

  it("charges the unreturned-bike fee only past 24 hours", () => {
    const onTime = quote(makeRide({ minutes: UNRETURNED_AFTER_MINUTES }), STANDARD);
    assert.deepEqual(onTime.fees, []);
    const late = quote(makeRide({ minutes: UNRETURNED_AFTER_MINUTES + 1 }), STANDARD);
    assert.deepEqual(late.fees, [{ code: "unreturned", amount: 200000 }]);
  });

  it("stacks both fees, out-of-zone first", () => {
    const result = quote(
      makeRide({ minutes: UNRETURNED_AFTER_MINUTES + 1, returnStation: OUT_ZONE }),
      STANDARD,
    );
    assert.deepEqual(result.fees, [
      { code: "out-of-zone", amount: 15000 },
      { code: "unreturned", amount: 200000 },
    ]);
    // The time charge is capped at the daily cap; the fees are added on top of it.
    assert.equal(result.total, DAY_CAP + 15000 + 200000);
  });

  it("halves the fees for a reduced fare", () => {
    const result = quote(makeRide({ minutes: 30, returnStation: OUT_ZONE }), REDUCED);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(result.total, 8750);
  });

  it("does not halve the fees for a subscriber", () => {
    const result = quote(makeRide({ minutes: 30, returnStation: OUT_ZONE }), SUBSCRIBER);
    assert.equal(result.total, 15000);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
  });

  it("halves the fees of a concession subscriber only when the reduced plan wins", () => {
    // Plans tie at 60 minutes, the subscription is kept, the fee stays whole.
    const tie = quote(makeRide({ minutes: 60, returnStation: OUT_ZONE }), CONCESSION);
    assert.deepEqual(tie.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(tie.total, 17500);
    // At 120 minutes the reduced plan wins and the fee is halved with it.
    const reducedWins = quote(makeRide({ minutes: 120, returnStation: OUT_ZONE }), CONCESSION);
    assert.deepEqual(reducedWins.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(reducedWins.total, 12500);
  });
});

describe("quote — daily cap (T6)", () => {
  it("caps the time charge at the daily cap even without a ledger", () => {
    const result = quote(makeRide({ minutes: 390 }), STANDARD); // 13 blocks = 32500
    assert.equal(result.timeCharge, 32500);
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(result.total, 30000);
  });

  it("does not cap a charge that reaches the cap exactly", () => {
    const result = quote(makeRide({ minutes: 360 }), STANDARD); // 12 blocks = 30000
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 30000);
  });

  it("caps what is left after the night discount", () => {
    const result = quote(makeRide({ pickupAt: NIGHT, minutes: 600 }), STANDARD);
    assert.equal(result.timeCharge, 50000);
    assert.deepEqual(result.discounts, [
      { code: "night", amount: 15000 },
      { code: "day-cap", amount: 5000 },
    ]);
    assert.equal(result.total, 30000);
  });

  it("spends the rider's remaining allowance across rides of one day", () => {
    const dayCap = createDayCap();
    const first = quote(makeRide({ minutes: 120 }), STANDARD, { dayCap });
    assert.equal(first.total, 10000);
    assert.equal(dayCap.remaining(STANDARD.id, Date.parse(NOON)), 20000);

    const second = quote(makeRide({ pickupAt: "2026-01-15T14:00:00Z", minutes: 390 }), STANDARD, { dayCap });
    assert.equal(second.timeCharge, 32500);
    assert.deepEqual(second.discounts, [{ code: "day-cap", amount: 12500 }]);
    assert.equal(second.total, 20000);
    assert.equal(dayCap.chargedOn(STANDARD.id, "2026-01-15"), 30000, "the capped amount is booked, not the gross one");
  });

  it("charges no time at all once the day's allowance is gone", () => {
    const dayCap = createDayCap();
    quote(makeRide({ minutes: 360 }), STANDARD, { dayCap });
    assert.equal(dayCap.remaining(STANDARD.id, Date.parse(NOON)), 0);

    const result = quote(makeRide({ pickupAt: "2026-01-15T18:00:00Z", minutes: 30 }), STANDARD, { dayCap });
    assert.equal(result.timeCharge, 2500);
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(result.total, 0);
  });

  it("still charges the fees when the allowance is gone", () => {
    const dayCap = createDayCap();
    quote(makeRide({ minutes: 360 }), STANDARD, { dayCap });
    const result = quote(
      makeRide({ pickupAt: "2026-01-15T18:00:00Z", minutes: 30, returnStation: OUT_ZONE }),
      STANDARD,
      { dayCap },
    );
    assert.equal(result.total, 15000);
  });

  it("gives every rider their own allowance", () => {
    const dayCap = createDayCap();
    quote(makeRide({ minutes: 360 }), STANDARD, { dayCap });
    const other = quote(makeRide({ minutes: 30 }), { type: "standard", id: "someone-else" }, { dayCap });
    assert.equal(other.total, 2500);
  });

  it("starts the allowance over on the next day", () => {
    const dayCap = createDayCap();
    quote(makeRide({ minutes: 360 }), STANDARD, { dayCap });
    const nextDay = quote(makeRide({ pickupAt: "2026-01-16T10:00:00Z", minutes: 30 }), STANDARD, { dayCap });
    assert.equal(nextDay.total, 2500);
    assert.equal(dayCap.chargedOn(STANDARD.id, "2026-01-16"), 2500);
  });

  it("honours a ledger with a custom limit", () => {
    const dayCap = createDayCap({ limit: 4000 });
    const result = quote(makeRide({ minutes: 60 }), STANDARD, { dayCap });
    assert.equal(result.timeCharge, 5000);
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 1000 }]);
    assert.equal(result.total, 4000);
  });

  it("books a free ride as zero and leaves the allowance untouched", () => {
    const dayCap = createDayCap();
    quote(makeRide({ minutes: 45 }), SUBSCRIBER, { dayCap });
    assert.equal(dayCap.chargedOn(SUBSCRIBER.id, "2026-01-15"), 0);
    assert.equal(dayCap.remaining(SUBSCRIBER.id, Date.parse(NOON)), DAY_CAP);
  });

  it("combines a reduced fare, a cap and halved fees", () => {
    const result = quote(
      makeRide({ minutes: UNRETURNED_AFTER_MINUTES + 1, returnStation: OUT_ZONE }),
      REDUCED,
    );
    assert.equal(result.timeCharge, 122500); // 49 started blocks
    assert.deepEqual(result.discounts, [
      { code: "reduced", amount: 61250 },
      { code: "day-cap", amount: 31250 },
    ]);
    assert.deepEqual(result.fees, [
      { code: "out-of-zone", amount: 7500 },
      { code: "unreturned", amount: 100000 },
    ]);
    assert.equal(result.total, 137500);
  });
});

describe("quote — zones option", () => {
  it("uses the built-in station table by default", () => {
    assert.deepEqual(quote(makeRide({ returnStation: "S05" }), STANDARD).fees, []);
    assert.deepEqual(quote(makeRide({ returnStation: "X03" }), STANDARD).fees, [
      { code: "out-of-zone", amount: 15000 },
    ]);
  });

  it("takes an injected station table instead", () => {
    const zones = createZones({ Z9: { name: "Тестова", zone: "out" } });
    const result = quote(makeRide({ returnStation: "Z9" }), STANDARD, { zones });
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.throws(() => quote(makeRide({ returnStation: "S01" }), STANDARD, { zones }), {
      name: "QuoteError",
      message: "unknown station: S01",
    });
  });
});

describe("quote — validation", () => {
  it("rejects a missing or non-object ride", () => {
    for (const bad of [undefined, null, "", 0, "a-ride"]) {
      assert.throws(() => quote(bad, STANDARD), { name: "QuoteError", message: "ride is required" });
    }
  });

  it("rejects timestamps that are not ISO date-times with an offset", () => {
    const bad = ["2026-01-15T10:00", "2026-01-15 10:00:00Z", "2026-01-15", "15/01/2026", "", "now"];
    for (const value of bad) {
      assert.throws(() => quote({ ...makeRide(), pickupAt: value }, STANDARD), {
        name: "QuoteError",
        message: "pickupAt must be an ISO 8601 date-time with an offset",
      });
    }
    assert.throws(() => quote({ ...makeRide(), returnAt: "2026-01-15T10:30" }, STANDARD), {
      name: "QuoteError",
      message: "returnAt must be an ISO 8601 date-time with an offset",
    });
  });

  it("rejects a non-string timestamp", () => {
    for (const value of [undefined, null, Date.parse(NOON), new Date(NOON)]) {
      assert.throws(() => quote({ ...makeRide(), pickupAt: value }, STANDARD), {
        name: "QuoteError",
        message: "pickupAt must be an ISO 8601 date-time with an offset",
      });
    }
  });

  it("accepts minutes-only, seconds and fractional-seconds precision", () => {
    assert.equal(quote({ ...makeRide(), pickupAt: "2026-01-15T10:00Z", returnAt: "2026-01-15T10:30Z" }, STANDARD).minutes, 30);
    assert.equal(
      quote({ ...makeRide(), pickupAt: "2026-01-15T10:00:00.000Z", returnAt: "2026-01-15T10:30:00.500Z" }, STANDARD).minutes,
      30,
    );
    assert.equal(
      quote({ ...makeRide(), pickupAt: "2026-01-15T12:00:00+02:00", returnAt: "2026-01-15T10:30:00Z" }, STANDARD).minutes,
      30,
    );
  });

  it("rejects a well-formed but impossible date-time", () => {
    for (const value of ["2026-13-01T10:00:00Z", "2026-01-15T25:00:00Z", "2026-01-32T10:00:00Z"]) {
      assert.throws(() => quote({ ...makeRide(), pickupAt: value }, STANDARD), {
        name: "QuoteError",
        message: "pickupAt is not a valid date-time",
      });
    }
  });

  it("accepts an overflowing day and rolls it over, as Date.parse does", () => {
    // 2026-02-30 is read as 2026-03-02; the ride is priced instead of rejected.
    const result = quote(
      { pickupAt: "2026-02-30T10:00:00Z", returnAt: "2026-03-02T10:30:00Z", bike: "classic", returnStation: IN_ZONE },
      STANDARD,
    );
    assert.equal(result.minutes, 30);
  });

  it("rejects a return before the pickup", () => {
    assert.throws(
      () => quote({ ...makeRide(), pickupAt: NOON, returnAt: "2026-01-15T09:59:59Z" }, STANDARD),
      { name: "QuoteError", message: "returnAt is before pickupAt" },
    );
  });

  it("rejects an unknown bike type", () => {
    for (const bike of ["scooter", "CLASSIC", undefined, null, ""]) {
      assert.throws(() => quote({ ...makeRide(), bike }, STANDARD), {
        name: "QuoteError",
        message: `unknown bike type: ${bike}`,
      });
    }
  });

  it("does not take a bike type off the prototype chain", () => {
    assert.throws(() => quote(makeRide({ bike: "constructor" }), STANDARD), {
      name: "QuoteError",
      message: "unknown bike type: constructor",
    });
  });

  it("rejects an unknown return station", () => {
    assert.throws(() => quote(makeRide({ returnStation: "ZZZ" }), STANDARD), {
      name: "QuoteError",
      message: "unknown station: ZZZ",
    });
    assert.throws(() => quote({ ...makeRide(), returnStation: undefined }, STANDARD), {
      name: "QuoteError",
      message: "unknown station: undefined",
    });
  });

  it("rejects an unknown or missing rider type", () => {
    for (const rider of [undefined, null, {}, { type: "vip" }, { type: "Standard" }]) {
      assert.throws(() => quote(makeRide(), rider), {
        name: "QuoteError",
        message: `unknown rider type: ${rider?.type}`,
      });
    }
  });

  it("requires a rider id when a ledger is given", () => {
    const dayCap = createDayCap();
    assert.throws(() => quote(makeRide(), { type: "standard" }, { dayCap }), {
      name: "QuoteError",
      message: "rider.id is required with a daily cap ledger",
    });
    assert.throws(() => quote(makeRide(), { type: "standard", id: "" }, { dayCap }), {
      name: "QuoteError",
      message: "rider.id is required with a daily cap ledger",
    });
  });

  it("needs no rider id without a ledger", () => {
    assert.equal(quote(makeRide(), { type: "standard" }).total, 2500);
  });

  it("checks the ride before the rider", () => {
    assert.throws(() => quote(makeRide({ bike: "scooter" }), { type: "vip" }), {
      message: "unknown bike type: scooter",
    });
  });

  it("throws QuoteError, an Error subclass", () => {
    const error = (() => {
      try {
        quote(null, STANDARD);
      } catch (thrown) {
        return thrown;
      }
    })();
    assert.ok(error instanceof QuoteError);
    assert.ok(error instanceof Error);
    assert.equal(error.name, "QuoteError");
  });

  it("does not book anything into the ledger when the ride is rejected", () => {
    const dayCap = createDayCap();
    assert.throws(() => quote(makeRide({ bike: "scooter" }), STANDARD, { dayCap }), QuoteError);
    assert.equal(dayCap.chargedOn(STANDARD.id, "2026-01-15"), 0);
  });
});
