import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { quote, discount, QuoteError, RATES } from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";
import { createZones } from "../../app/src/zones.js";

// Summer: Kyiv is UTC+3. `ride(min)` builds a ride of `min` minutes from PICKUP.
const PICKUP = "2026-06-15T12:00:00+03:00";
const addMin = (iso, min) => new Date(Date.parse(iso) + min * 60_000).toISOString();
const ride = (min, extra = {}) => ({
  pickupAt: PICKUP,
  returnAt: addMin(PICKUP, min),
  bike: "classic",
  returnStation: "S01",
  ...extra,
});
const std = { type: "standard", id: "r1" };

describe("discount()", () => {
  test("percent off, remainder rounded down to the kopeck", () => {
    assert.equal(discount(2500, 50), 1250);
    assert.equal(discount(5000, 30), 1500);
    assert.equal(discount(333, 30), 100); // pays floor(233.1) = 233
    assert.equal(discount(1, 50), 1); // pays floor(0.5) = 0
    assert.equal(discount(0, 50), 0);
  });
});

describe("time charge", () => {
  test("rides under 2 minutes are free", () => {
    const q = quote(ride(1), std);
    assert.equal(q.timeCharge, 0);
    assert.equal(q.total, 0);
    assert.deepEqual(q.discounts, []);
    assert.deepEqual(q.fees, []);
  });

  test("zero-length ride is free", () => {
    assert.equal(quote(ride(0), std).total, 0);
  });

  test("2 minutes already costs one block", () => {
    const q = quote(ride(2), std);
    assert.equal(q.minutes, 2);
    assert.equal(q.timeCharge, RATES.classic);
  });

  test("blocks of 30 minutes, a started block is charged", () => {
    assert.equal(quote(ride(30), std).timeCharge, 2500);
    assert.equal(quote(ride(31), std).timeCharge, 5000);
    assert.equal(quote(ride(60), std).timeCharge, 5000);
    assert.equal(quote(ride(61), std).timeCharge, 7500);
  });

  test("e-bike rate", () => {
    const q = quote(ride(60, { bike: "ebike" }), std);
    assert.equal(q.timeCharge, 8000);
    assert.equal(q.total, 8000);
  });

  test("minutes are rounded to the nearest minute", () => {
    const r = { ...ride(0), returnAt: "2026-06-15T12:01:59+03:00" }; // 119 s -> 2 min
    assert.equal(quote(r, std).minutes, 2);
    assert.equal(quote(r, std).timeCharge, 2500);
    const r2 = { ...ride(0), returnAt: "2026-06-15T12:01:29+03:00" }; // 89 s -> 1 min
    assert.equal(quote(r2, std).timeCharge, 0);
  });

  test("Z and offset timestamps denote the same instant", () => {
    const r = { ...ride(0), pickupAt: "2026-06-15T09:00:00Z", returnAt: "2026-06-15T12:45:00+03:00" };
    assert.equal(quote(r, std).minutes, 45);
  });
});

describe("rider plans", () => {
  test("reduced rider pays half", () => {
    const q = quote(ride(60), { type: "reduced" });
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 2500 }]);
    assert.equal(q.total, 2500);
  });

  test("subscriber: first 45 minutes are free (classic)", () => {
    const q = quote(ride(45), { type: "subscriber" });
    assert.equal(q.timeCharge, 5000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(q.total, 0);
  });

  test("subscriber classic beyond free minutes pays the remaining blocks", () => {
    const q = quote(ride(76), { type: "subscriber" }); // 31 min over -> 2 blocks
    assert.equal(q.total, 5000);
  });

  test("subscriber e-bike gets an extra 20% off the paid part", () => {
    const q = quote(ride(90, { bike: "ebike" }), { type: "subscriber" });
    assert.equal(q.timeCharge, 12000);
    assert.equal(q.total, 6400); // 2 blocks * 4000 = 8000, minus 20%
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5600 }]);
  });

  test("subscriber with concession gets the cheaper of subscription and reduced", () => {
    const q = quote(ride(120), { type: "subscriber", concession: true });
    // subscription: 3 blocks = 7500; reduced: 5000 -> reduced wins
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 5000 }]);
    assert.equal(q.total, 5000);
    // short ride: subscription (free) beats reduced
    const q2 = quote(ride(40), { type: "subscriber", concession: true });
    assert.equal(q2.discounts[0].code, "subscription");
    assert.equal(q2.total, 0);
  });

  test("concession is ignored for non-subscribers and when not strictly true", () => {
    assert.equal(quote(ride(60), { type: "standard", concession: true }).total, 5000);
    assert.equal(quote(ride(120), { type: "subscriber", concession: "yes" }).discounts[0].code, "subscription");
  });

  test("no discount entry when there is nothing to discount", () => {
    assert.deepEqual(quote(ride(1), { type: "reduced" }).discounts, []);
  });
});

describe("night discount (Kyiv time, before 06:00)", () => {
  const nightRide = (pickupAt, min = 60) => ({ ...ride(0), pickupAt, returnAt: addMin(pickupAt, min) });

  test("30% off a ride started at night", () => {
    const q = quote(nightRide("2026-06-15T03:00:00+03:00"), std);
    assert.deepEqual(q.discounts, [{ code: "night", amount: 1500 }]);
    assert.equal(q.total, 3500);
  });

  test("05:59 is night, 06:00 is not", () => {
    assert.equal(quote(nightRide("2026-06-15T05:59:00+03:00"), std).total, 3500);
    assert.equal(quote(nightRide("2026-06-15T06:00:00+03:00"), std).total, 5000);
  });

  test("hour is judged in Kyiv time, whatever offset the input uses", () => {
    assert.equal(quote(nightRide("2026-06-15T02:30:00Z"), std).total, 3500); // 05:30 Kyiv
    assert.equal(quote(nightRide("2026-06-15T03:00:00Z"), std).total, 5000); // 06:00 Kyiv
    assert.equal(quote(nightRide("2026-01-15T03:30:00Z"), std).total, 3500); // winter, UTC+2: 05:30 Kyiv
  });

  test("night applies on top of the plan discount", () => {
    const q = quote(nightRide("2026-06-15T02:00:00+03:00"), { type: "reduced" });
    assert.deepEqual(q.discounts, [
      { code: "reduced", amount: 2500 },
      { code: "night", amount: 750 },
    ]);
    assert.equal(q.total, 1750);
  });

  test("no night discount when nothing is left to pay", () => {
    const q = quote(nightRide("2026-06-15T02:00:00+03:00", 40), { type: "subscriber" });
    assert.equal(q.total, 0);
    assert.deepEqual(q.discounts.map((d) => d.code), ["subscription"]);
  });
});

describe("daily cap", () => {
  test("without a ledger a single ride is capped at 30000", () => {
    const q = quote(ride(24 * 60, { bike: "ebike" }), std); // 48 blocks = 192000
    assert.equal(q.timeCharge, 192000);
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 162000 }]);
    assert.equal(q.total, 30000);
  });

  test("a ride below the cap gets no day-cap discount", () => {
    const q = quote(ride(240, { bike: "ebike" }), std); // 8 blocks = 32000 -> capped
    assert.equal(q.total, 30000);
    const q2 = quote(ride(210, { bike: "ebike" }), std); // 7 blocks = 28000
    assert.equal(q2.total, 28000);
    assert.deepEqual(q2.discounts, []);
  });

  test("ledger: a second ride the same day gets only the remaining allowance", () => {
    const dayCap = createDayCap();
    const q1 = quote(ride(300, { bike: "ebike" }), std, { dayCap }); // 40000 -> 30000
    assert.equal(q1.total, 30000);
    assert.equal(dayCap.chargedOn("r1", "2026-06-15"), 30000);
    const q2 = quote(ride(60), std, { dayCap });
    assert.deepEqual(q2.discounts, [{ code: "day-cap", amount: 5000 }]);
    assert.equal(q2.total, 0);
  });

  test("ledger: partial remaining", () => {
    const dayCap = createDayCap();
    quote(ride(240), std, { dayCap }); // 8 blocks = 20000
    const q = quote(ride(180, { bike: "ebike" }), std, { dayCap }); // 24000, remaining 10000
    assert.equal(q.total, 10000);
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 14000 }]);
  });

  test("ledger books the amount due after discounts", () => {
    const dayCap = createDayCap();
    quote(ride(60), { type: "reduced", id: "r9" }, { dayCap });
    assert.equal(dayCap.chargedOn("r9", "2026-06-15"), 2500);
  });

  test("different riders have separate allowances", () => {
    const dayCap = createDayCap();
    quote(ride(300, { bike: "ebike" }), std, { dayCap });
    assert.equal(quote(ride(60), { type: "standard", id: "other" }, { dayCap }).total, 5000);
  });

  test("night discount is applied before the cap", () => {
    // 24h e-bike at night: 192000 -> 30% off = 134400 -> capped to 30000
    const p = "2026-06-15T01:00:00+03:00";
    const q = quote({ ...ride(0), pickupAt: p, returnAt: addMin(p, 24 * 60), bike: "ebike" }, std);
    assert.deepEqual(q.discounts.map((d) => d.code), ["night", "day-cap"]);
    assert.equal(q.total, 30000);
  });

  test("rider.id is required with a ledger", () => {
    assert.throws(() => quote(ride(60), { type: "standard" }, { dayCap: createDayCap() }), QuoteError);
  });
});

describe("fees", () => {
  test("out-of-zone return adds 15000", () => {
    const q = quote(ride(60, { returnStation: "X01" }), std);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(q.total, 20000);
  });

  test("fees are not subject to the daily cap", () => {
    const q = quote(ride(24 * 60, { bike: "ebike", returnStation: "X02" }), std);
    assert.equal(q.total, 30000 + 15000);
  });

  test("exactly 24h is not 'unreturned'; more than 24h adds 200000", () => {
    assert.deepEqual(quote(ride(1440, { bike: "ebike" }), std).fees, []);
    const q = quote(ride(1441, { bike: "ebike" }), std);
    assert.deepEqual(q.fees, [{ code: "unreturned", amount: 200000 }]);
    assert.equal(q.total, 230000);
  });

  test("both fees combine, in order", () => {
    const q = quote(ride(1441, { returnStation: "X03" }), std);
    assert.deepEqual(q.fees.map((f) => f.code), ["out-of-zone", "unreturned"]);
    assert.equal(q.total, 30000 + 15000 + 200000);
  });

  test("reduced fare halves the fees too", () => {
    const q = quote(ride(60, { returnStation: "X01" }), { type: "reduced" });
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(q.total, 2500 + 7500);
  });

  test("subscription does not discount fees", () => {
    const q = quote(ride(30, { returnStation: "X01" }), { type: "subscriber" });
    assert.equal(q.total, 15000);
  });

  test("a custom zone lookup is honoured", () => {
    const zones = createZones({ A: { name: "a", zone: "out" } });
    const q = quote(ride(60, { returnStation: "A" }), std, { zones });
    assert.equal(q.fees[0].code, "out-of-zone");
  });
});

describe("validation", () => {
  test("bad ride input", () => {
    assert.throws(() => quote(null, std), QuoteError);
    assert.throws(() => quote(ride(10, { pickupAt: "2026-06-15 12:00" }), std), QuoteError);
    assert.throws(() => quote(ride(10, { pickupAt: "2026-06-15T12:00:00" }), std), /offset/);
    assert.throws(() => quote(ride(10, { returnAt: undefined }), std), QuoteError);
    assert.throws(() => quote(ride(10, { pickupAt: "2026-13-15T12:00:00Z" }), std), /not a valid/);
  });

  test("return before pickup", () => {
    assert.throws(() => quote(ride(-5), std), /before/);
  });

  test("unknown bike, including inherited property names", () => {
    assert.throws(() => quote(ride(10, { bike: "tandem" }), std), /bike/);
    assert.throws(() => quote(ride(10, { bike: "toString" }), std), QuoteError);
  });

  test("unknown station", () => {
    assert.throws(() => quote(ride(10, { returnStation: "Z99" }), std), /station/);
    assert.throws(() => quote(ride(10, { returnStation: "constructor" }), std), QuoteError);
  });

  test("bad rider", () => {
    assert.throws(() => quote(ride(10), null), QuoteError);
    assert.throws(() => quote(ride(10), { type: "vip" }), /rider type/);
  });
});
