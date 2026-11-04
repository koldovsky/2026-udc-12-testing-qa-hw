import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  quote, discount, QuoteError, RATES, OUT_OF_ZONE_FEE, UNRETURNED_FEE,
} from "../../app/src/tariff.js";
import { createDayCap, DAY_CAP } from "../../app/src/day-cap.js";
import { createZones } from "../../app/src/zones.js";

// 07:00Z in September = 10:00 Kyiv (UTC+3), daytime.
const DAY = "2026-09-16T07:00:00Z";
const plus = (iso, min) => new Date(Date.parse(iso) + min * 60_000).toISOString();
const ride = (minutes, over = {}) => ({
  pickupAt: DAY, returnAt: plus(DAY, minutes), bike: "classic", returnStation: "S01", ...over,
});
const standard = { type: "standard" };
const reduced = { type: "reduced" };
const subscriber = { type: "subscriber" };

describe("time charge (blocks of 30 minutes)", () => {
  test("0 and 1 minute are free", () => {
    for (const m of [0, 1]) {
      const q = quote(ride(m), standard);
      assert.equal(q.timeCharge, 0);
      assert.equal(q.total, 0);
    }
  });
  test("2 minutes is one block", () => {
    assert.equal(quote(ride(2), standard).timeCharge, RATES.classic);
  });
  test("30 minutes is one block, 31 is two", () => {
    assert.equal(quote(ride(30), standard).timeCharge, 2500);
    assert.equal(quote(ride(31), standard).timeCharge, 5000);
  });
  test("ebike rate", () => {
    assert.equal(quote(ride(45, { bike: "ebike" }), standard).timeCharge, 8000);
  });
  test("minutes are rounded to the nearest minute", () => {
    const r = { ...ride(0), returnAt: "2026-09-16T07:30:29Z" };
    assert.equal(quote(r, standard).minutes, 30);
    const r2 = { ...ride(0), returnAt: "2026-09-16T07:30:30Z" };
    assert.equal(quote(r2, standard).minutes, 31);
  });
  test("result shape for a plain ride", () => {
    assert.deepEqual(quote(ride(20), standard), {
      minutes: 20, timeCharge: 2500, discounts: [], fees: [], total: 2500,
    });
  });
  test("offset timestamps are accepted", () => {
    const q = quote({ ...ride(0), pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:40:00+03:00" }, standard);
    assert.equal(q.minutes, 40);
    assert.equal(q.timeCharge, 5000);
  });
});

describe("subscription", () => {
  test("first 45 minutes free on classic", () => {
    const q = quote(ride(45), subscriber);
    assert.equal(q.timeCharge, 5000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(q.total, 0);
  });
  test("46 minutes: one paid block after free 45", () => {
    const q = quote(ride(46), subscriber);
    assert.equal(q.timeCharge, 5000);
    assert.equal(q.total, 2500);
  });
  test("ebike: 20% off the paid blocks", () => {
    const q = quote(ride(80, { bike: "ebike" }), subscriber); // 3 blocks = 12000; after 45 → 35 min → 2 blocks = 8000 → 6400
    assert.equal(q.timeCharge, 12000);
    assert.equal(q.total, 6400);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5600 }]);
  });
});

describe("reduced fare", () => {
  test("50% off time charge", () => {
    const q = quote(ride(60), reduced);
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 2500 }]);
    assert.equal(q.total, 2500);
  });
  test("subscriber with concession gets the cheaper plan", () => {
    // 100 min classic: 4 blocks = 10000; subscription → 55 min → 2 blocks = 5000 off; reduced → 5000 off; tie → subscription (first)
    const q1 = quote(ride(100), { type: "subscriber", concession: true });
    assert.equal(q1.total, 5000);
    // 200 min: 7 blocks = 17500; subscription → 155 → 6 blocks = 15000 (2500 off); reduced 8750 off
    const q2 = quote(ride(200), { type: "subscriber", concession: true });
    assert.deepEqual(q2.discounts, [{ code: "reduced", amount: 8750 }]);
    assert.equal(q2.total, 8750);
    // 40 min: subscription wins (full)
    const q3 = quote(ride(40), { type: "subscriber", concession: true });
    assert.deepEqual(q3.discounts, [{ code: "subscription", amount: 5000 }]);
  });
  test("concession on a non-subscriber standard rider is ignored", () => {
    assert.equal(quote(ride(60), { type: "standard", concession: true }).total, 5000);
  });
  test("concession must be strictly true", () => {
    const q = quote(ride(200), { type: "subscriber", concession: "yes" });
    assert.deepEqual(q.discounts.map((d) => d.code), ["subscription"]);
  });
});

describe("night discount", () => {
  test("pickup before 06:00 Kyiv gets 30% off", () => {
    const q = quote(ride(30, { pickupAt: "2026-09-16T02:00:00Z", returnAt: "2026-09-16T02:30:00Z" }), standard); // 05:00 Kyiv
    assert.deepEqual(q.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(q.total, 1750);
  });
  test("pickup at 06:00 Kyiv has no night discount", () => {
    const q = quote(ride(30, { pickupAt: "2026-09-16T03:00:00Z", returnAt: "2026-09-16T03:30:00Z" }), standard);
    assert.deepEqual(q.discounts, []);
  });
  test("night discount applies after reduced fare", () => {
    const q = quote(ride(60, { pickupAt: "2026-09-16T01:00:00Z", returnAt: "2026-09-16T02:00:00Z" }), reduced);
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 2500 }, { code: "night", amount: 750 }]);
    assert.equal(q.total, 1750);
  });
  test("no night entry when nothing is due", () => {
    const q = quote(ride(30, { pickupAt: "2026-09-16T01:00:00Z", returnAt: "2026-09-16T01:30:00Z" }), subscriber);
    assert.deepEqual(q.discounts.map((d) => d.code), ["subscription"]);
    assert.equal(q.total, 0);
  });
});

describe("fees", () => {
  test("out-of-zone return adds a fee", () => {
    const q = quote(ride(20, { returnStation: "X01" }), standard);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: OUT_OF_ZONE_FEE }]);
    assert.equal(q.total, 2500 + OUT_OF_ZONE_FEE);
  });
  test("ride over 24h adds unreturned fee; exactly 24h does not", () => {
    assert.deepEqual(quote(ride(24 * 60), standard).fees, []);
    const q = quote(ride(24 * 60 + 1), standard);
    assert.deepEqual(q.fees, [{ code: "unreturned", amount: UNRETURNED_FEE }]);
    assert.equal(q.total, DAY_CAP + UNRETURNED_FEE);
  });
  test("reduced plan halves fees", () => {
    const q = quote(ride(20, { returnStation: "X02" }), reduced);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: OUT_OF_ZONE_FEE / 2 }]);
  });
  test("fees are not capped by the day cap", () => {
    const q = quote(ride(24 * 60 + 1, { returnStation: "X03" }), standard);
    assert.equal(q.total, DAY_CAP + OUT_OF_ZONE_FEE + UNRETURNED_FEE);
  });
  test("custom zones option is used", () => {
    const zones = createZones({ Z9: { name: "t", zone: "out" } });
    const q = quote(ride(10, { returnStation: "Z9" }), standard, { zones });
    assert.equal(q.fees[0].code, "out-of-zone");
  });
});

describe("day cap inside quote", () => {
  test("without ledger, a single ride is capped at DAY_CAP", () => {
    const q = quote(ride(600), standard); // 20 blocks = 50000
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 50000 - DAY_CAP }]);
    assert.equal(q.total, DAY_CAP);
  });
  test("ledger accumulates across rides of the same rider and day", () => {
    const dayCap = createDayCap();
    const r = { ...standard, id: "r1" };
    assert.equal(quote(ride(300), r, { dayCap }).total, 25000);
    const q2 = quote(ride(60), r, { dayCap });
    assert.equal(q2.total, 5000);
    assert.deepEqual(q2.discounts, []);
    const q3 = quote(ride(60), r, { dayCap });
    assert.equal(q3.total, 0);
    assert.deepEqual(q3.discounts, [{ code: "day-cap", amount: 5000 }]);
    assert.equal(dayCap.chargedOn("r1", "2026-09-16"), DAY_CAP);
  });
  test("different riders have separate caps", () => {
    const dayCap = createDayCap();
    quote(ride(600), { ...standard, id: "a" }, { dayCap });
    assert.equal(quote(ride(30), { ...standard, id: "b" }, { dayCap }).total, 2500);
  });
  test("rider.id required with a ledger", () => {
    assert.throws(() => quote(ride(30), standard, { dayCap: createDayCap() }), QuoteError);
  });
});

describe("validation", () => {
  test("missing ride", () => assert.throws(() => quote(null, standard), QuoteError));
  test("unknown rider type", () => {
    assert.throws(() => quote(ride(10), { type: "vip" }), /unknown rider type/);
    assert.throws(() => quote(ride(10), undefined), QuoteError);
  });
  test("unknown bike", () => assert.throws(() => quote(ride(10, { bike: "tandem" }), standard), /unknown bike/));
  test("unknown station", () => assert.throws(() => quote(ride(10, { returnStation: "S99" }), standard), /unknown station/));
  test("return before pickup", () => assert.throws(() => quote(ride(-5), standard), /before pickupAt/));
  test("timestamps without offset are rejected", () => {
    assert.throws(() => quote(ride(10, { pickupAt: "2026-09-16T07:00:00" }), standard), /pickupAt/);
    assert.throws(() => quote(ride(10, { returnAt: 12345 }), standard), /returnAt/);
  });
  test("syntactically valid but impossible date is rejected", () => {
    assert.throws(() => quote(ride(10, { pickupAt: "2026-13-45T07:00:00Z" }), standard), QuoteError);
  });
  test("inherited property names are not bike types", () => {
    assert.throws(() => quote(ride(10, { bike: "toString" }), standard), QuoteError);
  });
});

describe("discount()", () => {
  test("rounds the amount left to pay down to the kopeck", () => {
    assert.equal(discount(2500, 30), 750);
    assert.equal(discount(1001, 50), 501); // left 500.5 → 500
    assert.equal(discount(333, 30), 100); // left 233.1 → 233
  });
  test("0% and 100%", () => {
    assert.equal(discount(1234, 0), 0);
    assert.equal(discount(1234, 100), 1234);
  });
});
