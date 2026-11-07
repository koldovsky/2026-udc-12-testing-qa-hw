// Unit tests for app/src/tariff.js — written from the code (no spec available to the author).
// Amounts are in kopecks. Daytime pickups are 10:00 Kyiv so the night discount stays out of the way.
import { describe, test } from "node:test";
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
import { DAY_CAP, createDayCap } from "../../app/src/day-cap.js";
import { createZones } from "../../app/src/zones.js";

const DAY = "2026-01-15T10:00:00+02:00";

/** A ride of `minutes` (+ extra `ms`) from `pickupAt`. */
function ride({ minutes = 10, ms = 0, bike = "classic", station = "S01", pickupAt = DAY } = {}) {
  const returnAt = new Date(Date.parse(pickupAt) + minutes * 60_000 + ms).toISOString();
  return { pickupAt, returnAt, bike, returnStation: station };
}

const standard = { type: "standard" };
const reduced = { type: "reduced" };
const subscriber = { type: "subscriber" };
const concession = { type: "subscriber", concession: true };

const codes = (items) => items.map((i) => i.code);
const amountOf = (items, code) => items.find((i) => i.code === code)?.amount;

describe("constants", () => {
  test("tariff constants have the values the code relies on", () => {
    assert.deepEqual({ ...RATES }, { classic: 2500, ebike: 4000 });
    assert.ok(Object.isFrozen(RATES));
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
});

describe("discount", () => {
  test("returns the percentage off for exact amounts", () => {
    assert.equal(discount(2500, 50), 1250);
    assert.equal(discount(2500, 30), 750);
    assert.equal(discount(4000, 20), 800);
  });

  test("rounds what is left to pay down, so the discount rounds up", () => {
    assert.equal(discount(1001, 50), 501); // left 500.5 → 500
    assert.equal(discount(1, 30), 1); // left 0.7 → 0
    assert.equal(discount(333, 30), 100); // left 233.1 → 233
  });

  test("edge percentages and zero amount", () => {
    assert.equal(discount(0, 50), 0);
    assert.equal(discount(2500, 0), 0);
    assert.equal(discount(2500, 100), 2500);
  });
});

describe("quote — result shape", () => {
  test("returns minutes, timeCharge, discounts, fees and total", () => {
    const q = quote(ride({ minutes: 10 }), standard);
    assert.deepEqual(q, { minutes: 10, timeCharge: 2500, discounts: [], fees: [], total: 2500 });
  });

  test("total = timeCharge − discounts + fees", () => {
    const q = quote(ride({ minutes: 100, bike: "ebike", station: "X01" }), reduced);
    const sum = q.timeCharge - q.discounts.reduce((s, d) => s + d.amount, 0) + q.fees.reduce((s, f) => s + f.amount, 0);
    assert.equal(q.total, sum);
  });
});

describe("quote — time charge (standard rider)", () => {
  test("a zero-length ride is free", () => {
    const q = quote(ride({ minutes: 0 }), standard);
    assert.equal(q.minutes, 0);
    assert.equal(q.timeCharge, 0);
    assert.equal(q.total, 0);
  });

  test("rides shorter than the free start (under 2 min) cost nothing", () => {
    assert.equal(quote(ride({ minutes: 1 }), standard).timeCharge, 0);
    assert.equal(quote(ride({ minutes: 1, ms: 29_000 }), standard).timeCharge, 0); // 1:29 → 1 min
  });

  test("from 2 minutes the first 30-minute block is charged in full", () => {
    assert.equal(quote(ride({ minutes: 2 }), standard).timeCharge, 2500);
    assert.equal(quote(ride({ minutes: 1, ms: 30_000 }), standard).timeCharge, 2500); // 1:30 rounds to 2
  });

  test("each started 30-minute block is charged", () => {
    assert.equal(quote(ride({ minutes: 30 }), standard).timeCharge, 2500);
    assert.equal(quote(ride({ minutes: 31 }), standard).timeCharge, 5000);
    assert.equal(quote(ride({ minutes: 60 }), standard).timeCharge, 5000);
    assert.equal(quote(ride({ minutes: 61 }), standard).timeCharge, 7500);
  });

  test("ride length is rounded to the nearest minute", () => {
    const under = quote(ride({ minutes: 30, ms: 29_999 }), standard);
    assert.equal(under.minutes, 30);
    assert.equal(under.timeCharge, 2500);
    const over = quote(ride({ minutes: 30, ms: 30_000 }), standard);
    assert.equal(over.minutes, 31);
    assert.equal(over.timeCharge, 5000);
  });

  test("e-bike rate is 40 UAH per block", () => {
    assert.equal(quote(ride({ minutes: 10, bike: "ebike" }), standard).timeCharge, 4000);
    assert.equal(quote(ride({ minutes: 45, bike: "ebike" }), standard).timeCharge, 8000);
  });

  test("pickup and return in different offsets are compared as instants", () => {
    const q = quote(
      { pickupAt: "2026-01-15T10:00:00+02:00", returnAt: "2026-01-15T08:40:00Z", bike: "classic", returnStation: "S01" },
      standard,
    );
    assert.equal(q.minutes, 40);
    assert.equal(q.timeCharge, 5000);
  });
});

describe("quote — reduced fare", () => {
  test("halves the time charge", () => {
    const q = quote(ride({ minutes: 40 }), reduced);
    assert.equal(q.timeCharge, 5000);
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 2500 }]);
    assert.equal(q.total, 2500);
  });

  test("no discount line when there is nothing to discount", () => {
    const q = quote(ride({ minutes: 1 }), reduced);
    assert.deepEqual(q.discounts, []);
    assert.equal(q.total, 0);
  });

  test("halves the out-of-zone fee", () => {
    const q = quote(ride({ minutes: 10, station: "X02" }), reduced);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(q.total, 1250 + 7500);
  });

  test("halves the unreturned-bike fee", () => {
    const q = quote(ride({ minutes: 1441 }), reduced);
    assert.equal(amountOf(q.fees, "unreturned"), 100000);
  });

  // Characterises current behaviour: fee halving is tied to the "reduced" plan being chosen,
  // and with a free (< 2 min) ride no plan is chosen, so the fee stays full.
  test("a reduced rider's free ride returned out of zone pays the full fee (current behaviour)", () => {
    const q = quote(ride({ minutes: 1, station: "X01" }), reduced);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: OUT_OF_ZONE_FEE }]);
    assert.equal(q.total, OUT_OF_ZONE_FEE);
  });
});

describe("quote — subscription", () => {
  test("the first 45 minutes are free", () => {
    const q = quote(ride({ minutes: 45 }), subscriber);
    assert.equal(q.timeCharge, 5000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(q.total, 0);
  });

  test("past 45 minutes, started blocks of the remainder are charged", () => {
    assert.equal(quote(ride({ minutes: 46 }), subscriber).total, 2500);
    assert.equal(quote(ride({ minutes: 75 }), subscriber).total, 2500);
    assert.equal(quote(ride({ minutes: 76 }), subscriber).total, 5000);
  });

  test("subscription discount = full charge − subscription charge", () => {
    const q = quote(ride({ minutes: 76 }), subscriber);
    assert.equal(q.timeCharge, 7500);
    assert.equal(amountOf(q.discounts, "subscription"), 2500);
  });

  test("e-bike subscription charge gets 20% off", () => {
    const q = quote(ride({ minutes: 46, bike: "ebike" }), subscriber);
    assert.equal(q.timeCharge, 8000);
    assert.equal(q.total, 3200); // 4000 − 20%
    assert.equal(amountOf(q.discounts, "subscription"), 4800);
  });

  test("subscriber fees are not reduced", () => {
    const q = quote(ride({ minutes: 10, station: "X03" }), subscriber);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: OUT_OF_ZONE_FEE }]);
    assert.equal(q.total, OUT_OF_ZONE_FEE);
  });

  test("a free subscriber ride has no discount line", () => {
    const q = quote(ride({ minutes: 1 }), subscriber);
    assert.deepEqual(q.discounts, []);
  });
});

describe("quote — subscriber with concession (cheaper plan wins)", () => {
  test("reduced fare wins when it is cheaper than subscription", () => {
    // ebike 120 min: full 16000; subscription 3 blocks → 12000 − 20% = 9600; reduced → 8000
    const q = quote(ride({ minutes: 120, bike: "ebike" }), concession);
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 8000 }]);
    assert.equal(q.total, 8000);
  });

  test("subscription wins when it is cheaper than reduced fare", () => {
    const q = quote(ride({ minutes: 45 }), concession);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(q.total, 0);
  });

  test("on a tie the subscription is chosen", () => {
    // classic 46 min: full 5000; subscription 2500; reduced 2500
    const q = quote(ride({ minutes: 46 }), concession);
    assert.deepEqual(codes(q.discounts), ["subscription"]);
    assert.equal(q.total, 2500);
  });

  test("fees are halved only when the reduced plan is chosen", () => {
    const viaReduced = quote(ride({ minutes: 120, bike: "ebike", station: "X01" }), concession);
    assert.equal(amountOf(viaReduced.fees, "out-of-zone"), 7500);
    // Current behaviour: subscription chosen → a concession holder pays the full fee.
    const viaSubscription = quote(ride({ minutes: 45, station: "X01" }), concession);
    assert.equal(amountOf(viaSubscription.fees, "out-of-zone"), OUT_OF_ZONE_FEE);
  });

  test("concession must be exactly true", () => {
    const q = quote(ride({ minutes: 120, bike: "ebike" }), { type: "subscriber", concession: "yes" });
    assert.deepEqual(codes(q.discounts), ["subscription"]);
  });

  test("concession is ignored for a standard rider", () => {
    const q = quote(ride({ minutes: 40 }), { type: "standard", concession: true });
    assert.deepEqual(q.discounts, []);
    assert.equal(q.total, 5000);
  });
});

describe("quote — night discount", () => {
  test("30% off for a pickup before 06:00 Kyiv time", () => {
    const q = quote(ride({ minutes: 10, pickupAt: "2026-01-15T03:00:00+02:00" }), standard);
    assert.deepEqual(q.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(q.total, 1750);
  });

  test("boundary: 05:59 is night, 06:00 is not (winter, UTC+2)", () => {
    assert.deepEqual(codes(quote(ride({ pickupAt: "2026-01-15T05:59:00+02:00" }), standard).discounts), ["night"]);
    assert.deepEqual(codes(quote(ride({ pickupAt: "2026-01-15T06:00:00+02:00" }), standard).discounts), []);
  });

  test("boundary: 00:00 Kyiv is night", () => {
    assert.deepEqual(codes(quote(ride({ pickupAt: "2026-01-15T00:00:00+02:00" }), standard).discounts), ["night"]);
  });

  test("Kyiv hour is used whatever offset the pickup is written in", () => {
    // 03:59Z = 05:59 Kyiv in winter; 04:00Z = 06:00 Kyiv
    assert.deepEqual(codes(quote(ride({ pickupAt: "2026-01-15T03:59:00Z" }), standard).discounts), ["night"]);
    assert.deepEqual(codes(quote(ride({ pickupAt: "2026-01-15T04:00:00Z" }), standard).discounts), []);
  });

  test("summer time (UTC+3) is respected", () => {
    // 02:59Z = 05:59 Kyiv in July; 03:00Z = 06:00 Kyiv
    assert.deepEqual(codes(quote(ride({ pickupAt: "2026-07-15T02:59:00Z" }), standard).discounts), ["night"]);
    assert.deepEqual(codes(quote(ride({ pickupAt: "2026-07-15T03:00:00Z" }), standard).discounts), []);
  });

  test("only the pickup time matters, not the return time", () => {
    const q = quote(ride({ minutes: 120, pickupAt: "2026-01-15T05:30:00+02:00" }), standard);
    assert.deepEqual(codes(q.discounts), ["night"]);
  });

  test("applies after the fare plan, on what is left to pay", () => {
    // reduced classic 10 min: 2500 → −1250 → 1250 → night −375 → 875
    const q = quote(ride({ minutes: 10, pickupAt: "2026-01-15T02:00:00+02:00" }), reduced);
    assert.deepEqual(q.discounts, [
      { code: "reduced", amount: 1250 },
      { code: "night", amount: 375 },
    ]);
    assert.equal(q.total, 875);
  });

  test("not applied when nothing is left to pay", () => {
    const q = quote(ride({ minutes: 30, pickupAt: "2026-01-15T02:00:00+02:00" }), subscriber);
    assert.deepEqual(codes(q.discounts), ["subscription"]);
    assert.equal(q.total, 0);
  });

  test("does not apply to fees", () => {
    const q = quote(ride({ minutes: 10, station: "X01", pickupAt: "2026-01-15T02:00:00+02:00" }), standard);
    assert.equal(amountOf(q.fees, "out-of-zone"), OUT_OF_ZONE_FEE);
    assert.equal(q.total, 1750 + OUT_OF_ZONE_FEE);
  });
});

describe("quote — daily cap without a ledger", () => {
  test("a single ride's time charge is capped at 300 UAH", () => {
    const q = quote(ride({ minutes: 390 }), standard); // 13 blocks = 32500
    assert.equal(q.timeCharge, 32500);
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(q.total, DAY_CAP);
  });

  test("exactly at the cap there is no day-cap line", () => {
    const q = quote(ride({ minutes: 360 }), standard); // 12 blocks = 30000
    assert.deepEqual(q.discounts, []);
    assert.equal(q.total, 30000);
  });

  test("the cap is applied after other discounts", () => {
    // ebike 8h night: 16 blocks = 64000 → night −19200 → 44800 → cap −14800
    const q = quote(ride({ minutes: 480, bike: "ebike", pickupAt: "2026-01-15T01:00:00+02:00" }), standard);
    assert.deepEqual(q.discounts, [
      { code: "night", amount: 19200 },
      { code: "day-cap", amount: 14800 },
    ]);
    assert.equal(q.total, DAY_CAP);
  });

  test("fees are added on top of the capped time charge", () => {
    const q = quote(ride({ minutes: 1441 }), standard);
    assert.equal(q.timeCharge, 49 * 2500);
    assert.equal(amountOf(q.discounts, "day-cap"), 49 * 2500 - DAY_CAP);
    assert.deepEqual(q.fees, [{ code: "unreturned", amount: UNRETURNED_FEE }]);
    assert.equal(q.total, DAY_CAP + UNRETURNED_FEE);
  });
});

describe("quote — daily cap with a ledger", () => {
  test("requires rider.id", () => {
    assert.throws(() => quote(ride(), standard, { dayCap: createDayCap() }), {
      name: "QuoteError",
      message: "rider.id is required with a daily cap ledger",
    });
  });

  test("books the amount due (after discounts) into the ledger", () => {
    const dayCap = createDayCap();
    quote(ride({ minutes: 10, pickupAt: "2026-01-15T03:00:00+02:00" }), { type: "standard", id: "r1" }, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 1750);
  });

  test("fees are not booked into the ledger", () => {
    const dayCap = createDayCap();
    quote(ride({ minutes: 10, station: "X01" }), { type: "standard", id: "r1" }, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 2500);
  });

  test("rides on the same day share the cap", () => {
    const dayCap = createDayCap();
    const rider = { type: "standard", id: "r1" };
    const at = (h) => `2026-01-15T${h}:00:00+02:00`;

    const first = quote(ride({ minutes: 300, pickupAt: at("08") }), rider, { dayCap }); // 25000
    assert.equal(first.total, 25000);

    const second = quote(ride({ minutes: 90, pickupAt: at("14") }), rider, { dayCap }); // 7500, 5000 left
    assert.deepEqual(second.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(second.total, 5000);

    const third = quote(ride({ minutes: 10, pickupAt: at("18") }), rider, { dayCap }); // nothing left
    assert.deepEqual(third.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(third.total, 0);

    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), DAY_CAP);
  });

  test("a capped-out rider still pays fees", () => {
    const dayCap = createDayCap({ limit: 0 });
    const q = quote(ride({ minutes: 10, station: "X01" }), { type: "standard", id: "r1" }, { dayCap });
    assert.equal(q.total, OUT_OF_ZONE_FEE);
  });

  test("other riders and other days are not affected", () => {
    const dayCap = createDayCap();
    quote(ride({ minutes: 400 }), { type: "standard", id: "r1" }, { dayCap });
    assert.equal(quote(ride({ minutes: 10 }), { type: "standard", id: "r2" }, { dayCap }).total, 2500);
    const nextDay = ride({ minutes: 10, pickupAt: "2026-01-16T10:00:00+02:00" });
    assert.equal(quote(nextDay, { type: "standard", id: "r1" }, { dayCap }).total, 2500);
  });

  test("honours a custom ledger limit", () => {
    const dayCap = createDayCap({ limit: 4000 });
    const q = quote(ride({ minutes: 40 }), { type: "standard", id: "r1" }, { dayCap });
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 1000 }]);
    assert.equal(q.total, 4000);
  });

  test("a free ride is booked as zero", () => {
    const dayCap = createDayCap();
    quote(ride({ minutes: 1 }), { type: "standard", id: "r1" }, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 0);
    assert.equal(dayCap.remaining("r1", Date.parse(DAY)), DAY_CAP);
  });

  // Characterises current behaviour: the ledger day is the UTC day of the pickup,
  // so a 01:00 Kyiv ride on the 16th is counted against the 15th.
  test("an after-midnight Kyiv ride is booked on the previous UTC day (current behaviour)", () => {
    const dayCap = createDayCap();
    const rider = { type: "standard", id: "r1" };
    quote(ride({ minutes: 330, pickupAt: "2026-01-15T12:00:00+02:00" }), rider, { dayCap }); // 27500
    const q = quote(ride({ minutes: 60, pickupAt: "2026-01-16T01:00:00+02:00" }), rider, { dayCap });
    // 5000 → night −1500 → 3500, but only 2500 left on the 15th
    assert.deepEqual(q.discounts, [
      { code: "night", amount: 1500 },
      { code: "day-cap", amount: 1000 },
    ]);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), DAY_CAP);
    assert.equal(dayCap.chargedOn("r1", "2026-01-16"), 0);
  });
});

describe("quote — fees", () => {
  test("out-of-zone return adds 150 UAH", () => {
    const q = quote(ride({ minutes: 10, station: "X01" }), standard);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(q.total, 17500);
  });

  test("in-zone return has no fee", () => {
    assert.deepEqual(quote(ride({ station: "S08" }), standard).fees, []);
  });

  test("unreturned fee applies strictly after 24 hours", () => {
    assert.deepEqual(quote(ride({ minutes: 1440 }), standard).fees, []);
    assert.deepEqual(codes(quote(ride({ minutes: 1441 }), standard).fees), ["unreturned"]);
  });

  test("both fees together, out-of-zone first", () => {
    const q = quote(ride({ minutes: 1500, station: "X01" }), standard);
    assert.deepEqual(q.fees, [
      { code: "out-of-zone", amount: OUT_OF_ZONE_FEE },
      { code: "unreturned", amount: UNRETURNED_FEE },
    ]);
    assert.equal(q.total, DAY_CAP + OUT_OF_ZONE_FEE + UNRETURNED_FEE);
  });

  test("fees apply even to a free ride", () => {
    const q = quote(ride({ minutes: 0, station: "X01" }), standard);
    assert.equal(q.total, OUT_OF_ZONE_FEE);
  });
});

describe("quote — zones option", () => {
  test("uses a custom station table", () => {
    const zones = createZones({ T1: { name: "Test", zone: "out" } });
    const q = quote(ride({ station: "T1" }), standard, { zones });
    assert.deepEqual(codes(q.fees), ["out-of-zone"]);
  });

  test("a default station is unknown to a custom table", () => {
    const zones = createZones({ T1: { name: "Test", zone: "in" } });
    assert.throws(() => quote(ride({ station: "S01" }), standard, { zones }), {
      name: "QuoteError",
      message: "unknown station: S01",
    });
  });

  test("any object with zoneOf works", () => {
    const q = quote(ride({ station: "anything" }), standard, { zones: { zoneOf: () => "in" } });
    assert.deepEqual(q.fees, []);
  });
});

describe("quote — validation", () => {
  const rejects = (fn, message) => assert.throws(fn, (err) => err instanceof QuoteError && err.message === message);

  test("QuoteError is an Error named QuoteError", () => {
    const err = new QuoteError("x");
    assert.ok(err instanceof Error);
    assert.equal(err.name, "QuoteError");
    assert.equal(err.message, "x");
  });

  test("ride is required and must be an object", () => {
    rejects(() => quote(undefined, standard), "ride is required");
    rejects(() => quote(null, standard), "ride is required");
    rejects(() => quote("ride", standard), "ride is required");
  });

  test("pickupAt / returnAt must be ISO date-times with an offset", () => {
    const msg = (f) => `${f} must be an ISO 8601 date-time with an offset`;
    rejects(() => quote({ ...ride(), pickupAt: undefined }, standard), msg("pickupAt"));
    rejects(() => quote({ ...ride(), pickupAt: Date.parse(DAY) }, standard), msg("pickupAt"));
    rejects(() => quote({ ...ride(), pickupAt: "2026-01-15T10:00:00" }, standard), msg("pickupAt"));
    rejects(() => quote({ ...ride(), pickupAt: "2026-01-15" }, standard), msg("pickupAt"));
    rejects(() => quote({ ...ride(), pickupAt: "2026-01-15 10:00Z" }, standard), msg("pickupAt"));
    rejects(() => quote({ ...ride(), pickupAt: "2026-01-15T10:00+0200" }, standard), msg("pickupAt"));
    rejects(() => quote({ ...ride(), returnAt: "yesterday" }, standard), msg("returnAt"));
  });

  test("accepted ISO variants: no seconds, fractional seconds, Z, offset", () => {
    const r = {
      pickupAt: "2026-01-15T10:00+02:00",
      returnAt: "2026-01-15T08:10:00.500Z",
      bike: "classic",
      returnStation: "S01",
    };
    assert.equal(quote(r, standard).minutes, 10); // 10.008 min → 10
  });

  test("a well-formed but impossible date is rejected", () => {
    rejects(() => quote({ ...ride(), pickupAt: "2026-13-01T10:00:00Z" }, standard), "pickupAt is not a valid date-time");
  });

  test("returnAt before pickupAt is rejected; equal is allowed", () => {
    rejects(
      () => quote({ ...ride(), returnAt: "2026-01-15T07:59:00Z" }, standard),
      "returnAt is before pickupAt",
    );
    assert.equal(quote({ ...ride(), returnAt: DAY }, standard).minutes, 0);
  });

  test("unknown bike types are rejected, including inherited property names", () => {
    rejects(() => quote(ride({ bike: "tandem" }), standard), "unknown bike type: tandem");
    rejects(() => quote({ ...ride(), bike: undefined }, standard), "unknown bike type: undefined");
    rejects(() => quote(ride({ bike: "toString" }), standard), "unknown bike type: toString");
  });

  test("unknown stations are rejected", () => {
    rejects(() => quote(ride({ station: "S99" }), standard), "unknown station: S99");
    rejects(() => quote(ride({ station: "__proto__" }), standard), "unknown station: __proto__");
  });

  test("rider must exist and have a known type", () => {
    rejects(() => quote(ride(), undefined), "unknown rider type: undefined");
    rejects(() => quote(ride(), {}), "unknown rider type: undefined");
    rejects(() => quote(ride(), { type: "vip" }), "unknown rider type: vip");
  });

  test("ride is validated before rider", () => {
    rejects(() => quote(null, null), "ride is required");
  });

  test("a failed quote books nothing into the ledger", () => {
    const dayCap = createDayCap();
    assert.throws(() => quote(ride({ station: "S99" }), { type: "standard", id: "r1" }, { dayCap }), QuoteError);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 0);
  });
});
