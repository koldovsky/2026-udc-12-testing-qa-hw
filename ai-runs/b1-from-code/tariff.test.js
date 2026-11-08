import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  quote, discount, QuoteError, RATES, OUT_OF_ZONE_FEE, UNRETURNED_FEE,
} from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";
import { createZones } from "../../app/src/zones.js";

// November: Kyiv is UTC+2. Daytime pickup = 12:00 Kyiv.
const DAY = "2026-11-06T10:00:00Z";
const plus = (iso, minutes, seconds = 0) =>
  new Date(Date.parse(iso) + minutes * 60_000 + seconds * 1000).toISOString();

const ride = (minutes, overrides = {}) => ({
  pickupAt: DAY,
  returnAt: plus(overrides.pickupAt ?? DAY, minutes),
  bike: "classic",
  returnStation: "S01",
  ...overrides,
});
const standard = { type: "standard" };
const reduced = { type: "reduced" };
const subscriber = { type: "subscriber" };

describe("discount", () => {
  test("percent off, remainder rounded down to the kopeck", () => {
    assert.equal(discount(5000, 50), 2500);
    assert.equal(discount(2501, 50), 1251); // pays 1250
    assert.equal(discount(2500, 30), 750);
    assert.equal(discount(4000, 20), 800);
    assert.equal(discount(0, 50), 0);
  });
});

describe("time charge", () => {
  test("rides under 2 minutes are free", () => {
    const q = quote(ride(1), standard);
    assert.deepEqual(q, { minutes: 1, timeCharge: 0, discounts: [], fees: [], total: 0 });
  });

  test("zero-length ride is free", () => {
    assert.equal(quote(ride(0), standard).total, 0);
  });

  test("minutes are rounded to the nearest minute", () => {
    const r1 = { ...ride(0), returnAt: plus(DAY, 1, 29) };
    const r2 = { ...ride(0), returnAt: plus(DAY, 1, 30) };
    assert.equal(quote(r1, standard).minutes, 1);
    assert.equal(quote(r1, standard).total, 0);
    assert.equal(quote(r2, standard).minutes, 2);
    assert.equal(quote(r2, standard).total, RATES.classic);
  });

  test("charged per started 30-minute block", () => {
    assert.equal(quote(ride(2), standard).timeCharge, 2500);
    assert.equal(quote(ride(30), standard).timeCharge, 2500);
    assert.equal(quote(ride(31), standard).timeCharge, 5000);
    assert.equal(quote(ride(60), standard).timeCharge, 5000);
    assert.equal(quote(ride(61), standard).timeCharge, 7500);
  });

  test("e-bike rate", () => {
    const q = quote(ride(31, { bike: "ebike" }), standard);
    assert.equal(q.timeCharge, 8000);
    assert.equal(q.total, 8000);
  });
});

describe("subscription", () => {
  test("first 45 minutes free", () => {
    const q = quote(ride(45), subscriber);
    assert.equal(q.timeCharge, 5000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(q.total, 0);
  });

  test("time beyond 45 minutes billed in blocks", () => {
    const q = quote(ride(46), subscriber);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(q.total, 2500);
  });

  test("e-bike over the free period gets 20% off", () => {
    // 76 min: full 3 blocks = 12000; subscription: 2 blocks * 4000 = 8000 - 20% = 6400
    const q = quote(ride(76, { bike: "ebike" }), subscriber);
    assert.equal(q.timeCharge, 12000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5600 }]);
    assert.equal(q.total, 6400);
  });

  test("short free ride gets no discount entry", () => {
    assert.deepEqual(quote(ride(1), subscriber).discounts, []);
  });
});

describe("reduced fare", () => {
  test("50% off time charge", () => {
    const q = quote(ride(31), reduced);
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 2500 }]);
    assert.equal(q.total, 2500);
  });

  test("concession subscriber gets the cheaper plan (reduced)", () => {
    // 120 min: 10000; subscription leaves 7500, reduced leaves 5000
    const q = quote(ride(120), { type: "subscriber", concession: true });
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 5000 }]);
    assert.equal(q.total, 5000);
  });

  test("concession subscriber gets the cheaper plan (subscription)", () => {
    const q = quote(ride(45), { type: "subscriber", concession: true });
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(q.total, 0);
  });

  test("concession must be exactly true", () => {
    const q = quote(ride(120), { type: "subscriber", concession: "yes" });
    assert.equal(q.discounts[0].code, "subscription");
  });

  test("concession flag is ignored for standard riders", () => {
    const q = quote(ride(31), { type: "standard", concession: true });
    assert.deepEqual(q.discounts, []);
    assert.equal(q.total, 5000);
  });
});

describe("night discount", () => {
  test("30% off for pickup before 06:00 Kyiv (winter, UTC+2)", () => {
    const q = quote(ride(30, { pickupAt: "2026-11-06T03:00:00+02:00" }), standard);
    assert.deepEqual(q.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(q.total, 1750);
  });

  test("no night discount from 06:00 Kyiv", () => {
    const q = quote(ride(30, { pickupAt: "2026-11-06T04:00:00Z" }), standard); // 06:00 Kyiv
    assert.deepEqual(q.discounts, []);
  });

  test("05:59 Kyiv qualifies", () => {
    const q = quote(ride(30, { pickupAt: "2026-11-06T03:59:00Z" }), standard);
    assert.equal(q.discounts[0].code, "night");
  });

  test("uses Kyiv summer time (UTC+3)", () => {
    const night = quote(ride(30, { pickupAt: "2026-07-01T02:59:00Z" }), standard); // 05:59 Kyiv
    const day = quote(ride(30, { pickupAt: "2026-07-01T03:00:00Z" }), standard); // 06:00 Kyiv
    assert.equal(night.discounts[0]?.code, "night");
    assert.deepEqual(day.discounts, []);
  });

  test("midnight Kyiv qualifies", () => {
    const q = quote(ride(30, { pickupAt: "2026-11-06T00:00:00+02:00" }), standard);
    assert.equal(q.discounts[0].code, "night");
  });

  test("applied after the fare plan", () => {
    const q = quote(ride(31, { pickupAt: "2026-11-06T03:00:00+02:00" }), reduced);
    assert.deepEqual(q.discounts, [
      { code: "reduced", amount: 2500 },
      { code: "night", amount: 750 },
    ]);
    assert.equal(q.total, 1750);
  });

  test("not listed when nothing is due", () => {
    const q = quote(ride(30, { pickupAt: "2026-11-06T03:00:00+02:00" }), subscriber);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 2500 }]);
  });

  test("pickup time matters, not return time", () => {
    const q = quote(ride(240, { pickupAt: "2026-11-06T05:30:00+02:00" }), standard);
    assert.equal(q.discounts[0].code, "night");
  });
});

describe("daily cap", () => {
  test("without a ledger a single ride is capped at 300 UAH", () => {
    const q = quote(ride(420), standard); // 14 blocks = 35000
    assert.equal(q.timeCharge, 35000);
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 5000 }]);
    assert.equal(q.total, 30000);
  });

  test("exactly the cap is not discounted", () => {
    const q = quote(ride(360), standard); // 12 blocks = 30000
    assert.deepEqual(q.discounts, []);
    assert.equal(q.total, 30000);
  });

  test("ledger caps across rides on the same day and records charges", () => {
    const cap = createDayCap();
    const rider = { type: "standard", id: "r1" };
    const first = quote(ride(300), rider, { dayCap: cap }); // 25000
    assert.equal(first.total, 25000);
    const second = quote(ride(60, { pickupAt: "2026-11-06T16:00:00Z" }), rider, { dayCap: cap }); // 5000
    assert.equal(second.total, 5000);
    const third = quote(ride(30, { pickupAt: "2026-11-06T18:00:00Z" }), rider, { dayCap: cap });
    assert.deepEqual(third.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(third.total, 0);
    assert.equal(cap.chargedOn("r1", "2026-11-06"), 30000);
  });

  test("ledger partially caps a ride", () => {
    const cap = createDayCap();
    cap.record("r1", Date.parse(DAY), 29000);
    const q = quote(ride(30), { type: "standard", id: "r1" }, { dayCap: cap });
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 1500 }]);
    assert.equal(q.total, 1000);
  });

  test("the cap applies after the fare plan", () => {
    const cap = createDayCap();
    cap.record("r1", Date.parse(DAY), 29000);
    const q = quote(ride(61), { type: "reduced", id: "r1" }, { dayCap: cap }); // 7500 -> 3750
    assert.deepEqual(q.discounts, [
      { code: "reduced", amount: 3750 },
      { code: "day-cap", amount: 2750 },
    ]);
    assert.equal(q.total, 1000);
  });

  test("different riders and days have separate caps", () => {
    const cap = createDayCap();
    quote(ride(360), { type: "standard", id: "r1" }, { dayCap: cap });
    assert.equal(quote(ride(30), { type: "standard", id: "r2" }, { dayCap: cap }).total, 2500);
    const nextDay = ride(30, { pickupAt: "2026-11-07T10:00:00Z" });
    assert.equal(quote(nextDay, { type: "standard", id: "r1" }, { dayCap: cap }).total, 2500);
  });

  test("respects a custom ledger limit", () => {
    const cap = createDayCap({ limit: 1000 });
    const q = quote(ride(30), { type: "standard", id: "r1" }, { dayCap: cap });
    assert.equal(q.total, 1000);
  });

  test("fees are not capped", () => {
    const cap = createDayCap();
    cap.record("r1", Date.parse(DAY), 30000);
    const q = quote(ride(30, { returnStation: "X01" }), { type: "standard", id: "r1" }, { dayCap: cap });
    assert.equal(q.total, OUT_OF_ZONE_FEE);
    assert.equal(cap.chargedOn("r1", "2026-11-06"), 30000);
  });

  test("free rides record nothing", () => {
    const cap = createDayCap();
    quote(ride(1), { type: "standard", id: "r1" }, { dayCap: cap });
    assert.equal(cap.chargedOn("r1", "2026-11-06"), 0);
  });
});

describe("fees", () => {
  test("out-of-zone return fee", () => {
    const q = quote(ride(30, { returnStation: "X02" }), standard);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: OUT_OF_ZONE_FEE }]);
    assert.equal(q.total, 2500 + OUT_OF_ZONE_FEE);
  });

  test("fee applies even to a free ride", () => {
    const q = quote(ride(1, { returnStation: "X03" }), standard);
    assert.equal(q.total, OUT_OF_ZONE_FEE);
  });

  test("unreturned fee after more than 24 hours", () => {
    const q = quote(ride(1441), standard);
    assert.deepEqual(q.fees, [{ code: "unreturned", amount: UNRETURNED_FEE }]);
    assert.equal(q.total, 30000 + UNRETURNED_FEE);
  });

  test("exactly 24 hours is not unreturned", () => {
    assert.deepEqual(quote(ride(1440), standard).fees, []);
  });

  test("both fees together, out-of-zone first", () => {
    const q = quote(ride(1441, { returnStation: "X01" }), standard);
    assert.deepEqual(q.fees.map((f) => f.code), ["out-of-zone", "unreturned"]);
    assert.equal(q.total, 30000 + OUT_OF_ZONE_FEE + UNRETURNED_FEE);
  });

  test("reduced fare halves fees", () => {
    const q = quote(ride(1441, { returnStation: "X01" }), reduced);
    assert.deepEqual(q.fees, [
      { code: "out-of-zone", amount: 7500 },
      { code: "unreturned", amount: 100000 },
    ]);
  });

  test("subscription does not reduce fees", () => {
    const q = quote(ride(30, { returnStation: "X01" }), subscriber);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: OUT_OF_ZONE_FEE }]);
  });

  test("concession subscriber gets halved fees only when the reduced plan wins", () => {
    const viaReduced = quote(ride(120, { returnStation: "X01" }), { type: "subscriber", concession: true });
    assert.equal(viaReduced.fees[0].amount, 7500);
    const viaSub = quote(ride(45, { returnStation: "X01" }), { type: "subscriber", concession: true });
    assert.equal(viaSub.fees[0].amount, OUT_OF_ZONE_FEE);
  });

  test("reduced rider on a free ride pays the full fee (current behaviour)", () => {
    // Halving depends on the "reduced" plan being picked, which needs a non-zero time charge.
    const q = quote(ride(1, { returnStation: "X01" }), reduced);
    assert.equal(q.fees[0].amount, OUT_OF_ZONE_FEE);
  });
});

describe("total", () => {
  test("equals timeCharge - discounts + fees", () => {
    const q = quote(
      ride(1441, { pickupAt: "2026-11-06T02:00:00+02:00", returnStation: "X01", bike: "ebike" }),
      { type: "subscriber", concession: true },
    );
    const d = q.discounts.reduce((s, x) => s + x.amount, 0);
    const f = q.fees.reduce((s, x) => s + x.amount, 0);
    assert.equal(q.total, q.timeCharge - d + f);
  });
});

describe("options", () => {
  test("custom zones lookup", () => {
    const zones = createZones({ Z1: { name: "Test", zone: "out" } });
    const q = quote(ride(30, { returnStation: "Z1" }), standard, { zones });
    assert.equal(q.fees[0].code, "out-of-zone");
    assert.throws(() => quote(ride(30), standard, { zones }), QuoteError);
  });
});

describe("validation", () => {
  const err = (re) => (e) => e instanceof QuoteError && e.name === "QuoteError" && re.test(e.message);

  test("ride is required", () => {
    assert.throws(() => quote(undefined, standard), err(/ride is required/));
    assert.throws(() => quote("x", standard), err(/ride is required/));
  });

  test("date-times must be ISO 8601 with an offset", () => {
    assert.throws(() => quote({ ...ride(30), pickupAt: "2026-11-06T10:00:00" }, standard), err(/pickupAt must be/));
    assert.throws(() => quote({ ...ride(30), returnAt: "2026-11-06" }, standard), err(/returnAt must be/));
    assert.throws(() => quote({ ...ride(30), pickupAt: Date.parse(DAY) }, standard), err(/pickupAt must be/));
  });

  test("accepts minutes-only and fractional seconds", () => {
    const r = { ...ride(0), pickupAt: "2026-11-06T12:00+02:00", returnAt: "2026-11-06T10:30:00.000Z" };
    assert.equal(quote(r, standard).minutes, 30);
  });

  test("rejects impossible dates", () => {
    assert.throws(() => quote({ ...ride(30), pickupAt: "2026-13-40T10:00:00Z" }, standard), err(/not a valid/));
  });

  test("returnAt before pickupAt", () => {
    assert.throws(() => quote({ ...ride(30), returnAt: plus(DAY, -1) }, standard), err(/before pickupAt/));
  });

  test("unknown bike type", () => {
    assert.throws(() => quote(ride(30, { bike: "scooter" }), standard), err(/unknown bike type/));
    assert.throws(() => quote(ride(30, { bike: "toString" }), standard), err(/unknown bike type/));
  });

  test("unknown station", () => {
    assert.throws(() => quote(ride(30, { returnStation: "S99" }), standard), err(/unknown station/));
  });

  test("unknown rider type", () => {
    assert.throws(() => quote(ride(30), { type: "vip" }), err(/unknown rider type/));
    assert.throws(() => quote(ride(30), undefined), err(/unknown rider type/));
  });

  test("rider.id required with a ledger", () => {
    assert.throws(() => quote(ride(30), standard, { dayCap: createDayCap() }), err(/rider.id is required/));
  });

  test("invalid input does not touch the ledger", () => {
    const cap = createDayCap();
    assert.throws(() => quote(ride(30, { bike: "x" }), { type: "standard", id: "r1" }, { dayCap: cap }));
    assert.equal(cap.chargedOn("r1", "2026-11-06"), 0);
  });
});
