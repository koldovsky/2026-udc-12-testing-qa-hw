// Unit tests for app/src/tariff.js — node:test + node:assert/strict, no npm deps.
// Expectations are derived from the code under test (rates in kopecks, 30-min blocks).

import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  BLOCK_MINUTES,
  FREE_START_MINUTES,
  NIGHT_PERCENT,
  NIGHT_UNTIL_HOUR,
  OUT_OF_ZONE_FEE,
  QuoteError,
  RATES,
  REDUCED_PERCENT,
  SUBSCRIPTION_EBIKE_PERCENT,
  SUBSCRIPTION_FREE_MINUTES,
  UNRETURNED_AFTER_MINUTES,
  UNRETURNED_FEE,
  discount,
  quote,
} from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";
import { createZones } from "../../app/src/zones.js";

const STANDARD = { type: "standard" };
const REDUCED = { type: "reduced" };
const SUBSCRIBER = { type: "subscriber" };

/** A ride ending `minutes` after `pickupAt`. */
function ride(pickupAt, minutes, { bike = "classic", returnStation = "S01" } = {}) {
  const returnAt = new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString().replace(".000Z", "Z");
  return { pickupAt, returnAt, bike, returnStation };
}

// A daytime instant in Kyiv (summer, UTC+3 → 13:00 local), so the night rule never fires.
const DAY = "2026-06-01T10:00:00Z";
// Kyiv winter is UTC+2: 02:00Z → 04:00 local, inside the night window.
const NIGHT = "2026-01-15T02:00:00Z";

describe("exported constants", () => {
  test("the published tariff numbers", () => {
    assert.deepEqual(RATES, { classic: 2500, ebike: 4000 });
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

  test("RATES is frozen", () => {
    assert.equal(Object.isFrozen(RATES), true);
  });
});

describe("discount()", () => {
  test("takes the given percent off", () => {
    assert.equal(discount(2500, 50), 1250);
    assert.equal(discount(4000, 20), 800);
  });

  test("rounds what is left to pay down, so the discount rounds up", () => {
    assert.equal(discount(2501, 50), 1251); // left to pay floor(1250.5) = 1250
    assert.equal(discount(999, 30), 300); // left to pay floor(699.3) = 699
  });

  test("0 % and 100 % are the limits", () => {
    assert.equal(discount(100, 0), 0);
    assert.equal(discount(100, 100), 100);
  });

  test("nothing off nothing", () => {
    assert.equal(discount(0, 50), 0);
  });
});

describe("quote() — time charge", () => {
  test("returns an itemised quote", () => {
    const result = quote(ride(DAY, 30), STANDARD);
    assert.deepEqual(result, {
      minutes: 30,
      timeCharge: 2500,
      discounts: [],
      fees: [],
      total: 2500,
    });
  });

  test("a started block is a whole block", () => {
    assert.equal(quote(ride(DAY, 31), STANDARD).total, 5000);
    assert.equal(quote(ride(DAY, 60), STANDARD).total, 5000);
    assert.equal(quote(ride(DAY, 61), STANDARD).total, 7500);
  });

  test("the first two minutes are free", () => {
    const result = quote(ride(DAY, 1), STANDARD);
    assert.equal(result.minutes, 1);
    assert.equal(result.timeCharge, 0);
    assert.equal(result.total, 0);
  });

  test("a ride of exactly two minutes is charged a full block", () => {
    assert.equal(quote(ride(DAY, 2), STANDARD).total, 2500);
  });

  test("a ride of zero length costs nothing", () => {
    const result = quote({ pickupAt: DAY, returnAt: DAY, bike: "classic", returnStation: "S01" }, STANDARD);
    assert.deepEqual(result, { minutes: 0, timeCharge: 0, discounts: [], fees: [], total: 0 });
  });

  test("duration is rounded to the nearest minute, which can cross the free-start line", () => {
    const result = quote(
      { pickupAt: "2026-06-01T10:00:00Z", returnAt: "2026-06-01T10:01:30Z", bike: "classic", returnStation: "S01" },
      STANDARD,
    );
    assert.equal(result.minutes, 2); // round(1.5)
    assert.equal(result.total, 2500);
  });

  test("30 seconds rounds up to one minute and stays free", () => {
    const result = quote(
      { pickupAt: "2026-06-01T10:00:00Z", returnAt: "2026-06-01T10:00:30Z", bike: "classic", returnStation: "S01" },
      STANDARD,
    );
    assert.equal(result.minutes, 1);
    assert.equal(result.total, 0);
  });

  test("an ebike costs more per block", () => {
    const result = quote(ride(DAY, 45, { bike: "ebike" }), STANDARD);
    assert.equal(result.timeCharge, 8000);
    assert.equal(result.total, 8000);
  });
});

describe("quote() — reduced fare", () => {
  test("halves the time charge", () => {
    const result = quote(ride(DAY, 30), REDUCED);
    assert.equal(result.timeCharge, 2500);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 1250 }]);
    assert.equal(result.total, 1250);
  });

  test("a free ride gets no reduced line", () => {
    const result = quote(ride(DAY, 1), REDUCED);
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 0);
  });

  test("a standard rider gets no reduced fare even when flagged as concession", () => {
    const result = quote(ride(DAY, 180), { type: "standard", concession: true });
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 15000);
  });
});

describe("quote() — subscription", () => {
  test("the first 45 minutes are free for a subscriber", () => {
    const result = quote(ride(DAY, 45), SUBSCRIBER);
    assert.equal(result.timeCharge, 5000);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(result.total, 0);
  });

  test("time past the free allowance is charged in whole blocks", () => {
    const result = quote(ride(DAY, 46), SUBSCRIBER);
    assert.equal(result.timeCharge, 5000);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 2500);
  });

  test("an ebike gets a further 20 % off the subscriber charge", () => {
    const result = quote(ride(DAY, 60, { bike: "ebike" }), SUBSCRIBER);
    assert.equal(result.timeCharge, 8000); // 2 blocks
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 4800 }]);
    assert.equal(result.total, 3200); // 4000 − 20 %
  });

  test("a longer ebike ride: blocks past the allowance, then 20 % off", () => {
    const result = quote(ride(DAY, 76, { bike: "ebike" }), SUBSCRIBER);
    assert.equal(result.timeCharge, 12000); // 3 blocks
    assert.equal(result.total, 6400); // 2 blocks = 8000 − 20 %
  });

  test("no subscription discount for a non-subscriber", () => {
    assert.deepEqual(quote(ride(DAY, 45), STANDARD).discounts, []);
  });
});

describe("quote() — subscriber with a concession", () => {
  test("takes the reduced fare when it leaves less to pay", () => {
    const result = quote(ride(DAY, 180), { type: "subscriber", concession: true });
    assert.equal(result.timeCharge, 15000);
    assert.deepEqual(result.discounts, [{ code: "reduced", amount: 7500 }]);
    assert.equal(result.total, 7500);
  });

  test("keeps the subscription when the two are worth the same", () => {
    const result = quote(ride(DAY, 60), { type: "subscriber", concession: true });
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 2500);
  });

  test("keeps the subscription when it is worth more", () => {
    const result = quote(ride(DAY, 50), { type: "subscriber", concession: true });
    assert.equal(result.timeCharge, 5000);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 2500);
  });

  test("only concession === true counts", () => {
    const result = quote(ride(DAY, 180), { type: "subscriber", concession: "yes" });
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 12500);
  });

  test("exactly one fare discount is ever applied", () => {
    const result = quote(ride(DAY, 180), { type: "subscriber", concession: true });
    assert.equal(result.discounts.filter((d) => d.code === "reduced" || d.code === "subscription").length, 1);
  });
});

describe("quote() — night discount", () => {
  test("a pickup before 06:00 Kyiv gets 30 % off", () => {
    const result = quote(ride(NIGHT, 30), STANDARD);
    assert.deepEqual(result.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(result.total, 1750);
  });

  test("05:59 Kyiv is still night (winter, UTC+2)", () => {
    assert.equal(quote(ride("2026-01-15T03:59:00Z", 30), STANDARD).total, 1750);
  });

  test("06:00 Kyiv is no longer night (winter, UTC+2)", () => {
    const result = quote(ride("2026-01-15T04:00:00Z", 30), STANDARD);
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 2500);
  });

  test("the window follows Kyiv summer time (UTC+3)", () => {
    assert.equal(quote(ride("2026-07-15T02:00:00Z", 30), STANDARD).total, 1750); // 05:00 Kyiv
    assert.equal(quote(ride("2026-07-15T03:00:00Z", 30), STANDARD).total, 2500); // 06:00 Kyiv
  });

  test("a pickup written with an offset is read as the same instant", () => {
    const result = quote(
      {
        pickupAt: "2026-07-15T05:00:00+03:00",
        returnAt: "2026-07-15T05:30:00+03:00",
        bike: "classic",
        returnStation: "S01",
      },
      STANDARD,
    );
    assert.equal(result.minutes, 30);
    assert.deepEqual(result.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(result.total, 1750);
  });

  test("the night discount comes off what is left after the fare discount", () => {
    const result = quote(ride(NIGHT, 30), REDUCED);
    assert.deepEqual(result.discounts, [
      { code: "reduced", amount: 1250 },
      { code: "night", amount: 375 },
    ]);
    assert.equal(result.total, 875);
  });

  test("nothing left to pay means no night line", () => {
    const result = quote(ride(NIGHT, 30), SUBSCRIBER);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(result.total, 0);
  });

  test("the return time does not matter, only the pickup", () => {
    // Picked up at 05:30 Kyiv (winter), returned at 06:30 — still a night ride.
    const result = quote(ride("2026-01-15T03:30:00Z", 60), STANDARD);
    assert.equal(result.timeCharge, 5000);
    assert.deepEqual(result.discounts, [{ code: "night", amount: 1500 }]);
    assert.equal(result.total, 3500);
  });
});

describe("quote() — daily cap without a ledger", () => {
  test("the time charge of a single ride is capped at 30000", () => {
    const result = quote(ride(DAY, 720), STANDARD);
    assert.equal(result.timeCharge, 60000); // 24 blocks
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 30000 }]);
    assert.equal(result.total, 30000);
  });

  test("a charge exactly at the cap is not discounted", () => {
    const result = quote(ride(DAY, 360), STANDARD); // 12 blocks = 30000
    assert.equal(result.timeCharge, 30000);
    assert.deepEqual(result.discounts, []);
    assert.equal(result.total, 30000);
  });
});

describe("quote() — daily cap with a ledger", () => {
  test("rides on the same day share one cap", () => {
    const dayCap = createDayCap();
    const rider = { type: "standard", id: "R1" };

    const first = quote(ride("2026-06-01T08:00:00Z", 300), rider, { dayCap });
    assert.equal(first.total, 25000); // 10 blocks
    assert.deepEqual(first.discounts, []);
    assert.equal(dayCap.chargedOn("R1", "2026-06-01"), 25000);

    const second = quote(ride("2026-06-01T14:00:00Z", 120), rider, { dayCap });
    assert.equal(second.timeCharge, 10000);
    assert.deepEqual(second.discounts, [{ code: "day-cap", amount: 5000 }]);
    assert.equal(second.total, 5000);
    assert.equal(dayCap.chargedOn("R1", "2026-06-01"), 30000);

    const third = quote(ride("2026-06-01T17:00:00Z", 30), rider, { dayCap });
    assert.deepEqual(third.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(third.total, 0);
    assert.equal(dayCap.chargedOn("R1", "2026-06-01"), 30000);
  });

  test("the next day starts from a clean cap", () => {
    const dayCap = createDayCap();
    const rider = { type: "standard", id: "R1" };
    quote(ride("2026-06-01T08:00:00Z", 720), rider, { dayCap });
    assert.equal(dayCap.chargedOn("R1", "2026-06-01"), 30000);

    const next = quote(ride("2026-06-02T08:00:00Z", 30), rider, { dayCap });
    assert.deepEqual(next.discounts, []);
    assert.equal(next.total, 2500);
    assert.equal(dayCap.chargedOn("R1", "2026-06-02"), 2500);
  });

  test("riders do not share a cap", () => {
    const dayCap = createDayCap();
    quote(ride(DAY, 720), { type: "standard", id: "R1" }, { dayCap });
    const other = quote(ride(DAY, 30), { type: "standard", id: "R2" }, { dayCap });
    assert.deepEqual(other.discounts, []);
    assert.equal(other.total, 2500);
  });

  test("a ledger can carry its own limit", () => {
    const dayCap = createDayCap({ limit: 4000 });
    const result = quote(ride(DAY, 60), { type: "standard", id: "R1" }, { dayCap });
    assert.equal(result.timeCharge, 5000);
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 1000 }]);
    assert.equal(result.total, 4000);
    assert.equal(dayCap.chargedOn("R1", "2026-06-01"), 4000);
  });

  test("the cap is applied after the night discount", () => {
    const dayCap = createDayCap({ limit: 1000 });
    const result = quote(ride(NIGHT, 30), { type: "standard", id: "R1" }, { dayCap });
    assert.deepEqual(result.discounts, [
      { code: "night", amount: 750 },
      { code: "day-cap", amount: 750 }, // the cap sees 1750, not the full 2500
    ]);
    assert.equal(result.total, 1000);
  });

  test("a rejected quote books nothing", () => {
    const dayCap = createDayCap();
    assert.throws(() => quote(ride(DAY, 30, { bike: "cargo" }), { type: "standard", id: "R1" }, { dayCap }), QuoteError);
    assert.equal(dayCap.chargedOn("R1", "2026-06-01"), 0);
  });

  test("a rider id is required with a ledger", () => {
    const dayCap = createDayCap();
    assert.throws(() => quote(ride(DAY, 30), STANDARD, { dayCap }), {
      name: "QuoteError",
      message: /rider\.id is required/,
    });
  });
});

describe("quote() — fees", () => {
  test("a return outside the zone adds a flat fee", () => {
    const result = quote(ride(DAY, 30, { returnStation: "X01" }), STANDARD);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 17500);
  });

  test("no fee for a return inside the zone", () => {
    assert.deepEqual(quote(ride(DAY, 30, { returnStation: "S08" }), STANDARD).fees, []);
  });

  test("a bike kept over 24 hours counts as unreturned", () => {
    const result = quote(ride(DAY, 1441), STANDARD);
    assert.equal(result.minutes, 1441);
    assert.equal(result.timeCharge, 122500); // 49 blocks
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 92500 }]);
    assert.deepEqual(result.fees, [{ code: "unreturned", amount: 200000 }]);
    assert.equal(result.total, 230000);
  });

  test("exactly 24 hours is still a returned bike", () => {
    const result = quote(ride(DAY, 1440), STANDARD);
    assert.deepEqual(result.fees, []);
    assert.equal(result.total, 30000);
  });

  test("both fees can apply, out-of-zone first", () => {
    const result = quote(ride(DAY, 1441, { returnStation: "X03" }), STANDARD);
    assert.deepEqual(result.fees, [
      { code: "out-of-zone", amount: 15000 },
      { code: "unreturned", amount: 200000 },
    ]);
    assert.equal(result.total, 245000);
  });

  test("fees are not touched by the daily cap", () => {
    const result = quote(ride(DAY, 720, { returnStation: "X01" }), STANDARD);
    assert.equal(result.total, 45000); // capped 30000 + full fee
  });

  test("a reduced-fare rider pays half the fees", () => {
    const result = quote(ride(DAY, 30, { returnStation: "X01" }), REDUCED);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(result.total, 8750);
  });

  test("half fees apply to every fee line", () => {
    const result = quote(ride(DAY, 1441, { returnStation: "X01" }), REDUCED);
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

  test("a subscription does not halve the fees", () => {
    const result = quote(ride(DAY, 60, { returnStation: "X01" }), SUBSCRIBER);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 17500);
  });

  test("a reduced rider whose fare discount is nil pays the full fee", () => {
    const result = quote(ride(DAY, 1, { returnStation: "X01" }), REDUCED);
    assert.deepEqual(result.discounts, []);
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(result.total, 15000);
  });
});

describe("quote() — zone lookup", () => {
  test("takes an injected station table", () => {
    const zones = createZones({ Z9: { name: "Тестова", zone: "out" } });
    const result = quote(ride(DAY, 30, { returnStation: "Z9" }), STANDARD, { zones });
    assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
  });

  test("stations outside the injected table are unknown", () => {
    const zones = createZones({ Z9: { name: "Тестова", zone: "in" } });
    assert.throws(() => quote(ride(DAY, 30, { returnStation: "S01" }), STANDARD, { zones }), {
      name: "QuoteError",
      message: /unknown station: S01/,
    });
  });
});

describe("quote() — rejected input", () => {
  test("QuoteError is an Error with its own name", () => {
    const error = new QuoteError("boom");
    assert.ok(error instanceof Error);
    assert.equal(error.name, "QuoteError");
    assert.equal(error.message, "boom");
  });

  test("a missing ride", () => {
    for (const bad of [null, undefined, "ride", 42]) {
      assert.throws(() => quote(bad, STANDARD), { name: "QuoteError", message: /ride is required/ });
    }
  });

  test("a date-time without an offset", () => {
    assert.throws(() => quote({ ...ride(DAY, 30), pickupAt: "2026-06-01T10:00" }, STANDARD), {
      name: "QuoteError",
      message: /pickupAt must be an ISO 8601 date-time with an offset/,
    });
    assert.throws(() => quote({ ...ride(DAY, 30), returnAt: "2026-06-01 10:30:00Z" }, STANDARD), {
      name: "QuoteError",
      message: /returnAt must be an ISO 8601 date-time with an offset/,
    });
  });

  test("a date-time that is not a string", () => {
    assert.throws(() => quote({ ...ride(DAY, 30), pickupAt: new Date(DAY) }, STANDARD), {
      name: "QuoteError",
      message: /pickupAt must be an ISO 8601 date-time with an offset/,
    });
  });

  test("a well-formed but impossible date-time", () => {
    assert.throws(() => quote({ ...ride(DAY, 30), pickupAt: "2026-13-01T10:00:00Z" }, STANDARD), {
      name: "QuoteError",
      message: /pickupAt is not a valid date-time/,
    });
  });

  test("a return before the pickup", () => {
    assert.throws(
      () =>
        quote(
          { pickupAt: DAY, returnAt: "2026-06-01T09:59:00Z", bike: "classic", returnStation: "S01" },
          STANDARD,
        ),
      { name: "QuoteError", message: /returnAt is before pickupAt/ },
    );
  });

  test("an unknown bike type", () => {
    assert.throws(() => quote(ride(DAY, 30, { bike: "cargo" }), STANDARD), {
      name: "QuoteError",
      message: /unknown bike type: cargo/,
    });
    assert.throws(() => quote({ ...ride(DAY, 30), bike: undefined }, STANDARD), {
      name: "QuoteError",
      message: /unknown bike type: undefined/,
    });
  });

  test("an inherited property is not a bike type", () => {
    assert.throws(() => quote(ride(DAY, 30, { bike: "toString" }), STANDARD), {
      name: "QuoteError",
      message: /unknown bike type: toString/,
    });
  });

  test("an unknown station", () => {
    assert.throws(() => quote(ride(DAY, 30, { returnStation: "S99" }), STANDARD), {
      name: "QuoteError",
      message: /unknown station: S99/,
    });
  });

  test("an unknown rider type", () => {
    assert.throws(() => quote(ride(DAY, 30), { type: "vip" }), {
      name: "QuoteError",
      message: /unknown rider type: vip/,
    });
    assert.throws(() => quote(ride(DAY, 30), null), {
      name: "QuoteError",
      message: /unknown rider type: undefined/,
    });
  });

  test("the ride is checked before the rider", () => {
    assert.throws(() => quote(ride(DAY, 30, { bike: "cargo" }), { type: "vip" }), {
      message: /unknown bike type/,
    });
  });
});
