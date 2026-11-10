// Unit tests for app/src/tariff.js — the itemised price of a ride, in kopecks.
// Written from the code only; they describe its current behaviour.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DAY_CAP, createDayCap } from "../../app/src/day-cap.js";
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

// 10 March 2026, 12:00 in Kyiv (UTC+2) — daytime, so no night discount.
const DAY = "2026-03-10T10:00:00Z";

/** A ride of `seconds` from `pickupAt`; returnAt is written as an ISO string with milliseconds and Z. */
function rideOf({ seconds, bike = "classic", station = "S01", pickupAt = DAY }) {
  const returnAt = new Date(Date.parse(pickupAt) + seconds * 1000).toISOString();
  return { pickupAt, returnAt, bike, returnStation: station };
}

const ride = ({ minutes, ...rest }) => rideOf({ seconds: minutes * 60, ...rest });

const STANDARD = { type: "standard" };
const REDUCED = { type: "reduced" };
const SUBSCRIBER = { type: "subscriber" };
const CONCESSION = { type: "subscriber", concession: true };

const sum = (items) => items.reduce((s, i) => s + i.amount, 0);

describe("tariff constants", () => {
  test("have the values the rest of these tests assume", () => {
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

  test("RATES is frozen", () => {
    assert.ok(Object.isFrozen(RATES));
  });
});

describe("discount", () => {
  test("takes the percentage off", () => {
    assert.equal(discount(2500, 50), 1250);
    assert.equal(discount(2500, 30), 750);
    assert.equal(discount(4000, 20), 800);
  });

  test("rounds what is left to pay down, so the discount rounds up", () => {
    assert.equal(discount(101, 50), 51); // pays 50, not 50.5
    assert.equal(discount(999, 30), 300); // pays 699, not 699.3
    assert.equal(discount(1, 30), 1); // pays 0, not 0.7
  });

  test("handles 0 % and 100 % and a zero amount", () => {
    assert.equal(discount(2500, 0), 0);
    assert.equal(discount(2500, 100), 2500);
    assert.equal(discount(0, 50), 0);
  });
});

describe("quote: result shape", () => {
  test("returns minutes, timeCharge, discounts, fees and total", () => {
    const q = quote(ride({ minutes: 30 }), STANDARD);
    assert.deepEqual(q, { minutes: 30, timeCharge: 2500, discounts: [], fees: [], total: 2500 });
  });

  test("total = timeCharge − discounts + fees, across many cases", () => {
    const riders = [STANDARD, REDUCED, SUBSCRIBER, CONCESSION];
    const minutes = [0, 1, 2, 30, 31, 45, 46, 60, 200, 600, 1440, 1441];
    const pickups = [DAY, "2026-01-15T02:00:00Z"]; // day, night
    for (const rider of riders)
      for (const m of minutes)
        for (const bike of ["classic", "ebike"])
          for (const station of ["S01", "X01"])
            for (const pickupAt of pickups) {
              const q = quote(ride({ minutes: m, bike, station, pickupAt }), rider);
              const label = JSON.stringify({ rider, m, bike, station, pickupAt });
              assert.equal(q.total, q.timeCharge - sum(q.discounts) + sum(q.fees), label);
              assert.ok(q.total >= 0, label);
              for (const d of q.discounts) assert.ok(d.amount > 0, `${label} ${d.code}`);
            }
  });

  test("does not mutate its arguments", () => {
    const r = ride({ minutes: 30 });
    const rider = { ...REDUCED };
    const before = JSON.stringify([r, rider]);
    quote(r, rider);
    assert.equal(JSON.stringify([r, rider]), before);
  });
});

describe("quote: time charge", () => {
  test("a zero-length ride is free", () => {
    const q = quote(ride({ minutes: 0 }), STANDARD);
    assert.equal(q.minutes, 0);
    assert.equal(q.timeCharge, 0);
    assert.equal(q.total, 0);
  });

  test("the first minute is free (under FREE_START_MINUTES)", () => {
    assert.equal(quote(ride({ minutes: 1 }), STANDARD).timeCharge, 0);
    assert.equal(quote(ride({ minutes: 1, bike: "ebike" }), STANDARD).timeCharge, 0);
  });

  test("from 2 minutes a whole 30-minute block is charged", () => {
    assert.equal(quote(ride({ minutes: 2 }), STANDARD).timeCharge, 2500);
    assert.equal(quote(ride({ minutes: 2, bike: "ebike" }), STANDARD).timeCharge, 4000);
  });

  test("blocks are rounded up", () => {
    assert.equal(quote(ride({ minutes: 30 }), STANDARD).timeCharge, 2500);
    assert.equal(quote(ride({ minutes: 31 }), STANDARD).timeCharge, 5000);
    assert.equal(quote(ride({ minutes: 60 }), STANDARD).timeCharge, 5000);
    assert.equal(quote(ride({ minutes: 61 }), STANDARD).timeCharge, 7500);
    assert.equal(quote(ride({ minutes: 31, bike: "ebike" }), STANDARD).timeCharge, 8000);
  });

  test("ride length is rounded to the nearest minute", () => {
    assert.equal(quote(rideOf({ seconds: 89 }), STANDARD).minutes, 1);
    assert.equal(quote(rideOf({ seconds: 89 }), STANDARD).timeCharge, 0);
    assert.equal(quote(rideOf({ seconds: 90 }), STANDARD).minutes, 2);
    assert.equal(quote(rideOf({ seconds: 90 }), STANDARD).timeCharge, 2500);
    assert.equal(quote(rideOf({ seconds: 30 * 60 + 29 }), STANDARD).timeCharge, 2500);
    assert.equal(quote(rideOf({ seconds: 30 * 60 + 30 }), STANDARD).minutes, 31);
    assert.equal(quote(rideOf({ seconds: 30 * 60 + 30 }), STANDARD).timeCharge, 5000);
  });

  test("pickup and return may be written with different offsets", () => {
    const r = { pickupAt: "2026-03-10T12:00:00+02:00", returnAt: "2026-03-10T10:45Z", bike: "classic", returnStation: "S01" };
    const q = quote(r, STANDARD);
    assert.equal(q.minutes, 45);
    assert.equal(q.timeCharge, 5000);
  });
});

describe("quote: subscription", () => {
  test("the first 45 minutes are free", () => {
    const q = quote(ride({ minutes: 45 }), SUBSCRIBER);
    assert.equal(q.timeCharge, 5000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(q.total, 0);
  });

  test("after 45 minutes, blocks are counted from minute 45", () => {
    const q = quote(ride({ minutes: 46 }), SUBSCRIBER);
    assert.equal(q.timeCharge, 5000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(q.total, 2500);

    const long = quote(ride({ minutes: 200 }), SUBSCRIBER); // 7 blocks vs 6 blocks
    assert.equal(long.timeCharge, 17500);
    assert.equal(long.total, 15000);
  });

  test("e-bike blocks after the free time are 20 % off", () => {
    const q = quote(ride({ minutes: 60, bike: "ebike" }), SUBSCRIBER);
    assert.equal(q.timeCharge, 8000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 4800 }]);
    assert.equal(q.total, 3200); // 4000 − 20 %

    const long = quote(ride({ minutes: 120, bike: "ebike" }), SUBSCRIBER);
    assert.equal(long.timeCharge, 16000);
    assert.equal(long.total, 9600); // 3 blocks × 4000 − 20 %
  });

  test("an e-bike within 45 minutes is free", () => {
    assert.equal(quote(ride({ minutes: 45, bike: "ebike" }), SUBSCRIBER).total, 0);
  });

  test("no discount line when there is nothing to discount", () => {
    const q = quote(ride({ minutes: 1 }), SUBSCRIBER);
    assert.deepEqual(q.discounts, []);
    assert.equal(q.total, 0);
  });
});

describe("quote: reduced fare", () => {
  test("is 50 % off the time charge", () => {
    const q = quote(ride({ minutes: 30 }), REDUCED);
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 1250 }]);
    assert.equal(q.total, 1250);

    const e = quote(ride({ minutes: 90, bike: "ebike" }), REDUCED);
    assert.equal(e.timeCharge, 12000);
    assert.equal(e.total, 6000);
  });

  test("does not apply to a standard rider, even with concession: true", () => {
    const q = quote(ride({ minutes: 30 }), { type: "standard", concession: true });
    assert.deepEqual(q.discounts, []);
    assert.equal(q.total, 2500);
  });
});

describe("quote: subscriber with a concession gets the cheaper plan", () => {
  test("subscription when it is cheaper", () => {
    const q = quote(ride({ minutes: 40 }), CONCESSION);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(q.total, 0);
  });

  test("reduced fare when it is cheaper", () => {
    const q = quote(ride({ minutes: 200 }), CONCESSION);
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 8750 }]);
    assert.equal(q.total, 8750);
  });

  test("on a tie the subscription is chosen", () => {
    const q = quote(ride({ minutes: 60 }), CONCESSION); // both are 2500 off 5000
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(q.total, 2500);
  });

  test("only concession === true counts", () => {
    for (const concession of [false, "yes", 1, undefined]) {
      const q = quote(ride({ minutes: 200 }), { type: "subscriber", concession });
      assert.deepEqual(q.discounts, [{ code: "subscription", amount: 2500 }], String(concession));
    }
  });

  test("only one fare discount is ever applied", () => {
    const q = quote(ride({ minutes: 200, bike: "ebike" }), CONCESSION);
    const fare = q.discounts.filter((d) => d.code === "subscription" || d.code === "reduced");
    assert.equal(fare.length, 1);
  });
});

describe("quote: night discount (pickup before 06:00 Kyiv time)", () => {
  test("30 % off in winter (UTC+2): 05:59 yes, 06:00 no", () => {
    const night = quote(ride({ minutes: 30, pickupAt: "2026-01-15T03:59:00Z" }), STANDARD);
    assert.deepEqual(night.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(night.total, 1750);

    const morning = quote(ride({ minutes: 30, pickupAt: "2026-01-15T04:00:00Z" }), STANDARD);
    assert.deepEqual(morning.discounts, []);
    assert.equal(morning.total, 2500);
  });

  test("follows summer time (UTC+3): 05:59 yes, 06:00 no", () => {
    assert.equal(quote(ride({ minutes: 30, pickupAt: "2026-07-01T02:59:00Z" }), STANDARD).total, 1750);
    assert.equal(quote(ride({ minutes: 30, pickupAt: "2026-07-01T03:00:00Z" }), STANDARD).total, 2500);
  });

  test("starts at midnight Kyiv time", () => {
    assert.equal(quote(ride({ minutes: 30, pickupAt: "2026-01-14T22:00:00Z" }), STANDARD).total, 1750); // 00:00
    assert.equal(quote(ride({ minutes: 30, pickupAt: "2026-01-14T21:59:00Z" }), STANDARD).total, 2500); // 23:59
  });

  test("depends on pickup time only, even if the ride ends after 06:00", () => {
    const q = quote(ride({ minutes: 30, pickupAt: "2026-01-15T03:50:00Z" }), STANDARD);
    assert.deepEqual(q.discounts, [{ code: "night", amount: 750 }]);
  });

  test("reads a pickup written with an offset", () => {
    const q = quote(ride({ minutes: 30, pickupAt: "2026-01-15T05:30:00+02:00" }), STANDARD);
    assert.deepEqual(q.discounts, [{ code: "night", amount: 750 }]);
  });

  test("is applied after the fare discount, to what is left", () => {
    const q = quote(ride({ minutes: 30, pickupAt: "2026-01-15T02:00:00Z" }), REDUCED);
    assert.deepEqual(q.discounts, [
      { code: "reduced", amount: 1250 },
      { code: "night", amount: 375 },
    ]);
    assert.equal(q.total, 875);

    const sub = quote(ride({ minutes: 46, pickupAt: "2026-01-15T02:00:00Z" }), SUBSCRIBER);
    assert.deepEqual(sub.discounts, [
      { code: "subscription", amount: 2500 },
      { code: "night", amount: 750 },
    ]);
    assert.equal(sub.total, 1750);
  });

  test("no night line when nothing is left to pay", () => {
    const q = quote(ride({ minutes: 30, pickupAt: "2026-01-15T02:00:00Z" }), SUBSCRIBER);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(quote(ride({ minutes: 1, pickupAt: "2026-01-15T02:00:00Z" }), STANDARD).discounts.length, 0);
  });
});

describe("quote: daily cap without a ledger", () => {
  test("a single ride's time charge is capped at DAY_CAP", () => {
    const q = quote(ride({ minutes: 600 }), STANDARD); // 20 blocks
    assert.equal(q.timeCharge, 50000);
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 20000 }]);
    assert.equal(q.total, DAY_CAP);
  });

  test("exactly DAY_CAP is not capped", () => {
    const q = quote(ride({ minutes: 360 }), STANDARD); // 12 blocks
    assert.equal(q.timeCharge, 30000);
    assert.deepEqual(q.discounts, []);
  });

  test("is applied after the night discount", () => {
    const q = quote(ride({ minutes: 600, pickupAt: "2026-01-15T02:00:00Z" }), STANDARD);
    assert.deepEqual(q.discounts, [
      { code: "night", amount: 15000 },
      { code: "day-cap", amount: 5000 },
    ]);
    assert.equal(q.total, DAY_CAP);
  });

  test("is applied after the fare discount", () => {
    const q = quote(ride({ minutes: 1441 }), REDUCED); // 49 blocks = 122500, half = 61250
    assert.deepEqual(q.discounts, [
      { code: "reduced", amount: 61250 },
      { code: "day-cap", amount: 31250 },
    ]);
  });

  test("fees are not capped", () => {
    const q = quote(ride({ minutes: 1500, station: "X01" }), STANDARD);
    assert.equal(q.timeCharge, 125000);
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 95000 }]);
    assert.deepEqual(q.fees, [
      { code: "out-of-zone", amount: 15000 },
      { code: "unreturned", amount: 200000 },
    ]);
    assert.equal(q.total, 245000);
  });
});

describe("quote: daily cap with a ledger", () => {
  const rider = (id, base = STANDARD) => ({ ...base, id });

  test("books what the rider pays for time", () => {
    const cap = createDayCap();
    quote(ride({ minutes: 240 }), rider("r1"), { dayCap: cap }); // 8 blocks
    assert.equal(cap.chargedOn("r1", "2026-03-10"), 20000);
  });

  test("a later ride the same day is capped at what remains", () => {
    const cap = createDayCap();
    quote(ride({ minutes: 240 }), rider("r1"), { dayCap: cap });
    const q = quote(ride({ minutes: 300, pickupAt: "2026-03-10T15:00:00Z" }), rider("r1"), { dayCap: cap });
    assert.equal(q.timeCharge, 25000);
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 15000 }]);
    assert.equal(q.total, 10000);
    assert.equal(cap.chargedOn("r1", "2026-03-10"), DAY_CAP);
  });

  test("once the cap is used up, time is free but fees still apply", () => {
    const cap = createDayCap();
    quote(ride({ minutes: 600 }), rider("r1"), { dayCap: cap });
    const q = quote(ride({ minutes: 30, station: "X01", pickupAt: "2026-03-10T18:00:00Z" }), rider("r1"), { dayCap: cap });
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(q.total, 15000);
    assert.equal(cap.chargedOn("r1", "2026-03-10"), DAY_CAP);
  });

  test("books the amount after discounts, and never fees", () => {
    const cap = createDayCap();
    quote(ride({ minutes: 30, station: "X01" }), rider("r1", REDUCED), { dayCap: cap });
    assert.equal(cap.chargedOn("r1", "2026-03-10"), 1250);
  });

  test("other riders and other days are not affected", () => {
    const cap = createDayCap();
    quote(ride({ minutes: 600 }), rider("r1"), { dayCap: cap });
    assert.equal(quote(ride({ minutes: 30 }), rider("r2"), { dayCap: cap }).total, 2500);
    assert.equal(quote(ride({ minutes: 30, pickupAt: "2026-03-11T10:00:00Z" }), rider("r1"), { dayCap: cap }).total, 2500);
  });

  test("respects a ledger with a custom limit", () => {
    const cap = createDayCap({ limit: 4000 });
    const q = quote(ride({ minutes: 60 }), rider("r1"), { dayCap: cap });
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 1000 }]);
    assert.equal(q.total, 4000);
  });

  test("requires rider.id", () => {
    const cap = createDayCap();
    assert.throws(() => quote(ride({ minutes: 30 }), STANDARD, { dayCap: cap }), {
      name: "QuoteError",
      message: /rider\.id is required/,
    });
    assert.equal(cap.chargedOn("undefined", "2026-03-10"), 0);
  });

  test("rider.id is not needed without a ledger", () => {
    assert.doesNotThrow(() => quote(ride({ minutes: 30 }), STANDARD));
  });

  test("an invalid ride books nothing", () => {
    const cap = createDayCap();
    assert.throws(() => quote({ ...ride({ minutes: 30 }), bike: "scooter" }, rider("r1"), { dayCap: cap }), QuoteError);
    assert.equal(cap.remaining("r1", DAY), DAY_CAP);
  });

  // NOTE: the ledger books by UTC date (see day-cap.test.js), so two rides on the same Kyiv day
  // can fall on different ledger days.
  test("books by UTC date (current behaviour)", () => {
    const cap = createDayCap();
    quote(ride({ minutes: 600, pickupAt: "2026-01-14T23:30:00Z" }), rider("r1"), { dayCap: cap }); // 01:30, 15 Jan Kyiv
    const q = quote(ride({ minutes: 600, pickupAt: "2026-01-15T08:00:00Z" }), rider("r1"), { dayCap: cap }); // 10:00, 15 Jan Kyiv
    assert.equal(q.total, DAY_CAP);
  });
});

describe("quote: fees", () => {
  test("returning outside the zone costs 150 UAH", () => {
    const q = quote(ride({ minutes: 30, station: "X01" }), STANDARD);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(q.total, 17500);
  });

  test("the out-of-zone fee applies even to a free ride", () => {
    assert.equal(quote(ride({ minutes: 0, station: "X02" }), STANDARD).total, 15000);
    assert.equal(quote(ride({ minutes: 30, station: "X03" }), SUBSCRIBER).total, 15000);
  });

  test("no fees for a return inside the zone", () => {
    assert.deepEqual(quote(ride({ minutes: 30, station: "S08" }), STANDARD).fees, []);
  });

  test("unreturned fee only for rides longer than 24 h", () => {
    const day = quote(ride({ minutes: 1440 }), STANDARD);
    assert.deepEqual(day.fees, []);
    assert.equal(day.total, DAY_CAP);

    const over = quote(ride({ minutes: 1441 }), STANDARD);
    assert.deepEqual(over.fees, [{ code: "unreturned", amount: 200000 }]);
    assert.equal(over.total, 230000);
  });

  test("fees are halved when the reduced fare is applied", () => {
    const q = quote(ride({ minutes: 1441, station: "X01" }), REDUCED);
    assert.deepEqual(q.fees, [
      { code: "out-of-zone", amount: 7500 },
      { code: "unreturned", amount: 100000 },
    ]);
    assert.equal(q.total, 30000 + 107500);
  });

  test("a concession subscriber gets halved fees only when the reduced plan wins", () => {
    const reduced = quote(ride({ minutes: 200, station: "X01" }), CONCESSION);
    assert.deepEqual(reduced.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(reduced.total, 16250);

    const subscription = quote(ride({ minutes: 40, station: "X01" }), CONCESSION);
    assert.deepEqual(subscription.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(subscription.total, 15000);
  });

  test("subscription does not reduce fees", () => {
    assert.deepEqual(quote(ride({ minutes: 1441, station: "X01" }), SUBSCRIBER).fees, [
      { code: "out-of-zone", amount: 15000 },
      { code: "unreturned", amount: 200000 },
    ]);
  });

  // NOTE: fees are halved only when "reduced" is the chosen plan, and a plan is chosen only if
  // it gives a positive discount. With a free time charge (< 2 min) a reduced rider pays the
  // full out-of-zone fee.
  test("a reduced rider pays the full fee when the time charge is 0 (current behaviour)", () => {
    const q = quote(ride({ minutes: 1, station: "X01" }), REDUCED);
    assert.deepEqual(q.discounts, []);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(q.total, 15000);
  });

  test("uses the zones lookup passed in options", () => {
    const zones = { zoneOf: (id) => (id === "TEST" ? "out" : null) };
    const q = quote(ride({ minutes: 30, station: "TEST" }), STANDARD, { zones });
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.throws(() => quote(ride({ minutes: 30, station: "S01" }), STANDARD, { zones }), /unknown station: S01/);
  });
});

describe("quote: validation", () => {
  const ok = ride({ minutes: 30 });
  const rejects = (r, rider, message) =>
    assert.throws(
      () => quote(r, rider),
      (err) => err instanceof QuoteError && err.name === "QuoteError" && message.test(err.message),
    );

  test("ride is required", () => {
    rejects(undefined, STANDARD, /ride is required/);
    rejects(null, STANDARD, /ride is required/);
    rejects("ride", STANDARD, /ride is required/);
  });

  test("pickupAt and returnAt must be ISO 8601 with Z or an offset", () => {
    rejects({ ...ok, pickupAt: undefined }, STANDARD, /pickupAt must be an ISO 8601/);
    rejects({ ...ok, pickupAt: "2026-03-10T10:00:00" }, STANDARD, /pickupAt must be an ISO 8601/);
    rejects({ ...ok, pickupAt: "2026-03-10 10:00:00Z" }, STANDARD, /pickupAt must be an ISO 8601/);
    rejects({ ...ok, pickupAt: "2026-03-10" }, STANDARD, /pickupAt must be an ISO 8601/);
    rejects({ ...ok, pickupAt: Date.parse(DAY) }, STANDARD, /pickupAt must be an ISO 8601/);
    rejects({ ...ok, returnAt: "tomorrow" }, STANDARD, /returnAt must be an ISO 8601/);
  });

  test("accepts minutes-only and fractional-second forms", () => {
    assert.equal(quote({ ...ok, pickupAt: "2026-03-10T10:00Z", returnAt: "2026-03-10T10:30Z" }, STANDARD).minutes, 30);
    assert.equal(quote({ ...ok, pickupAt: "2026-03-10T10:00:00.5+00:00" }, STANDARD).minutes, 30);
  });

  test("a well-formed but impossible date is rejected", () => {
    rejects({ ...ok, pickupAt: "2026-13-01T10:00:00Z" }, STANDARD, /pickupAt is not a valid date-time/);
  });

  test("returnAt may not be before pickupAt", () => {
    rejects({ ...ok, returnAt: "2026-03-10T09:59:00Z" }, STANDARD, /returnAt is before pickupAt/);
  });

  test("bike must be classic or ebike", () => {
    rejects({ ...ok, bike: "scooter" }, STANDARD, /unknown bike type: scooter/);
    rejects({ ...ok, bike: undefined }, STANDARD, /unknown bike type/);
    rejects({ ...ok, bike: "toString" }, STANDARD, /unknown bike type: toString/);
  });

  test("return station must be known", () => {
    rejects({ ...ok, returnStation: "S99" }, STANDARD, /unknown station: S99/);
    rejects({ ...ok, returnStation: "toString" }, STANDARD, /unknown station: toString/);
  });

  test("rider type must be standard, reduced or subscriber", () => {
    rejects(ok, undefined, /unknown rider type: undefined/);
    rejects(ok, {}, /unknown rider type: undefined/);
    rejects(ok, { type: "vip" }, /unknown rider type: vip/);
  });
});
