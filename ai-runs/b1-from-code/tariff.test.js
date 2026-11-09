import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { quote, discount, QuoteError, RATES } from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";
import { createZones } from "../../app/src/zones.js";

// 2026-01-15 10:00Z = 12:00 in Kyiv (UTC+2): daytime.
const PICKUP = "2026-01-15T10:00:00Z";

function at(iso, minutes) {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

function ride(minutes, extra = {}) {
  const pickupAt = extra.pickupAt ?? PICKUP;
  return { pickupAt, returnAt: at(pickupAt, minutes), bike: "classic", returnStation: "S01", ...extra };
}

const standard = { type: "standard" };

describe("discount", () => {
  test("computes percent off, rounding what is left down", () => {
    assert.equal(discount(2500, 50), 1250);
    assert.equal(discount(2500, 30), 750);
    assert.equal(discount(4000, 20), 800);
  });

  test("rounding the remainder down makes the discount round up", () => {
    assert.equal(discount(2501, 50), 1251); // pay 1250
  });

  test("0 amount gives 0", () => {
    assert.equal(discount(0, 50), 0);
  });
});

describe("base time charge", () => {
  test("rides shorter than 2 minutes are free", () => {
    const q = quote(ride(1), standard);
    assert.deepEqual(q, { minutes: 1, timeCharge: 0, discounts: [], fees: [], total: 0 });
  });

  test("zero-length ride is free", () => {
    assert.equal(quote(ride(0), standard).total, 0);
  });

  test("2 minutes costs one block", () => {
    const q = quote(ride(2), standard);
    assert.equal(q.minutes, 2);
    assert.equal(q.timeCharge, 2500);
    assert.equal(q.total, 2500);
  });

  test("block boundaries: 30 min is one block, 31 is two", () => {
    assert.equal(quote(ride(30), standard).total, 2500);
    assert.equal(quote(ride(31), standard).total, 5000);
    assert.equal(quote(ride(60), standard).total, 5000);
    assert.equal(quote(ride(61), standard).total, 7500);
  });

  test("ebike uses its own rate", () => {
    assert.equal(RATES.ebike, 4000);
    assert.equal(quote(ride(30, { bike: "ebike" }), standard).total, 4000);
    assert.equal(quote(ride(31, { bike: "ebike" }), standard).total, 8000);
  });

  test("duration is rounded to the nearest minute", () => {
    const pickupAt = PICKUP;
    const r = (seconds) => ({
      pickupAt,
      returnAt: new Date(Date.parse(pickupAt) + seconds * 1000).toISOString(),
      bike: "classic",
      returnStation: "S01",
    });
    assert.equal(quote(r(89), standard).minutes, 1);
    assert.equal(quote(r(89), standard).total, 0);
    assert.equal(quote(r(90), standard).minutes, 2);
    assert.equal(quote(r(90), standard).total, 2500);
  });

  test("offsets are honoured when measuring duration", () => {
    const q = quote(
      { pickupAt: "2026-01-15T12:00:00+02:00", returnAt: "2026-01-15T10:30:00Z", bike: "classic", returnStation: "S01" },
      standard,
    );
    assert.equal(q.minutes, 30);
  });
});

describe("reduced fare", () => {
  test("reduced rider pays half", () => {
    const q = quote(ride(30), { type: "reduced" });
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 1250 }]);
    assert.equal(q.total, 1250);
  });

  test("ebike reduced", () => {
    assert.equal(quote(ride(30, { bike: "ebike" }), { type: "reduced" }).total, 2000);
  });

  test("concession flag is ignored for a standard rider", () => {
    assert.equal(quote(ride(30), { type: "standard", concession: true }).total, 2500);
  });

  test("free ride has no discount entry", () => {
    const q = quote(ride(1), { type: "reduced" });
    assert.deepEqual(q.discounts, []);
    assert.equal(q.total, 0);
  });
});

describe("subscription", () => {
  const sub = { type: "subscriber" };

  test("first 45 minutes are free", () => {
    const q = quote(ride(45), sub);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(q.total, 0);
  });

  test("minutes past 45 are charged in blocks", () => {
    const q = quote(ride(46), sub);
    assert.equal(q.timeCharge, 5000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(q.total, 2500);
  });

  test("ebike gets an extra 20% off the chargeable part", () => {
    const q = quote(ride(46, { bike: "ebike" }), sub);
    assert.equal(q.timeCharge, 8000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 4800 }]);
    assert.equal(q.total, 3200);
  });

  test("subscriber without concession never gets the reduced fare", () => {
    const q = quote(ride(130), { type: "subscriber", concession: false });
    assert.equal(q.discounts[0].code, "subscription");
  });

  test("concession: subscription wins when it leaves less to pay", () => {
    const q = quote(ride(75), { type: "subscriber", concession: true });
    // 3 blocks = 7500; subscription 5000 off vs reduced 3750 off
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
    assert.equal(q.total, 2500);
  });

  test("concession: reduced wins when it leaves less to pay", () => {
    const q = quote(ride(130), { type: "subscriber", concession: true });
    // 5 blocks = 12500; subscription 5000 off vs reduced 6250 off
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 6250 }]);
    assert.equal(q.total, 6250);
  });

  test("concession: a tie keeps the subscription", () => {
    const q = quote(ride(46), { type: "subscriber", concession: true });
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 2500 }]);
  });

  test("plans are not combined", () => {
    const q = quote(ride(130), { type: "subscriber", concession: true });
    assert.equal(q.discounts.length, 1);
  });
});

describe("night discount", () => {
  test("30% off for pickups before 06:00 Kyiv time", () => {
    // 03:00Z = 05:00 Kyiv (winter, UTC+2)
    const q = quote(ride(30, { pickupAt: "2026-01-15T03:00:00Z" }), standard);
    assert.deepEqual(q.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(q.total, 1750);
  });

  test("05:59 Kyiv is night, 06:00 Kyiv is not", () => {
    assert.equal(quote(ride(30, { pickupAt: "2026-01-15T03:59:00Z" }), standard).total, 1750);
    assert.equal(quote(ride(30, { pickupAt: "2026-01-15T04:00:00Z" }), standard).total, 2500);
  });

  test("uses summer time (UTC+3) in July", () => {
    assert.equal(quote(ride(30, { pickupAt: "2026-07-15T02:30:00Z" }), standard).total, 1750); // 05:30 Kyiv
    assert.equal(quote(ride(30, { pickupAt: "2026-07-15T03:30:00Z" }), standard).total, 2500); // 06:30 Kyiv
  });

  test("midnight in Kyiv counts as night", () => {
    // 22:00Z on the 14th = 00:00 Kyiv on the 15th
    assert.equal(quote(ride(30, { pickupAt: "2026-01-14T22:00:00Z" }), standard).total, 1750);
  });

  test("applies after the plan discount", () => {
    const q = quote(ride(30, { pickupAt: "2026-01-15T03:00:00Z" }), { type: "reduced" });
    assert.deepEqual(q.discounts, [
      { code: "reduced", amount: 1250 },
      { code: "night", amount: 375 },
    ]);
    assert.equal(q.total, 875);
  });

  test("not added when nothing is left to pay", () => {
    const q = quote(ride(1, { pickupAt: "2026-01-15T03:00:00Z" }), standard);
    assert.deepEqual(q.discounts, []);
    const free = quote(ride(45, { pickupAt: "2026-01-15T03:00:00Z" }), { type: "subscriber" });
    assert.deepEqual(free.discounts.map((d) => d.code), ["subscription"]);
  });
});

describe("daily cap", () => {
  test("a long ride is capped at 30000 even without a ledger", () => {
    const q = quote(ride(24 * 60), standard); // 48 blocks = 120000
    assert.equal(q.timeCharge, 120000);
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 90000 }]);
    assert.equal(q.total, 30000);
  });

  test("exactly at the cap gives no cap discount", () => {
    const q = quote(ride(12 * 30), standard); // 12 blocks = 30000
    assert.equal(q.total, 30000);
    assert.deepEqual(q.discounts, []);
  });

  test("ledger books the amount charged", () => {
    const dayCap = createDayCap();
    quote(ride(30), { type: "standard", id: "r1" }, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 2500);
  });

  test("later rides the same day share the remaining allowance", () => {
    const dayCap = createDayCap();
    const rider = { type: "standard", id: "r1" };
    const first = quote(ride(11 * 30), rider, { dayCap }); // 27500
    assert.equal(first.total, 27500);
    const second = quote(ride(30), rider, { dayCap }); // 2500 fits exactly
    assert.equal(second.total, 2500);
    const third = quote(ride(30), rider, { dayCap });
    assert.deepEqual(third.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(third.total, 0);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 30000);
  });

  test("allowance is partially used", () => {
    const dayCap = createDayCap();
    const rider = { type: "standard", id: "r1" };
    quote(ride(11 * 30), rider, { dayCap });
    const q = quote(ride(3 * 30), rider, { dayCap }); // 7500 due, 2500 left
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 5000 }]);
    assert.equal(q.total, 2500);
  });

  test("other riders and other days are unaffected", () => {
    const dayCap = createDayCap();
    quote(ride(24 * 60), { type: "standard", id: "r1" }, { dayCap });
    assert.equal(quote(ride(30), { type: "standard", id: "r2" }, { dayCap }).total, 2500);
    assert.equal(
      quote(ride(30, { pickupAt: "2026-01-16T10:00:00Z" }), { type: "standard", id: "r1" }, { dayCap }).total,
      2500,
    );
  });

  test("cap applies after discounts, and records the discounted amount", () => {
    const dayCap = createDayCap();
    // reduced: 120000 -> 60000 due, capped to 30000
    const q = quote(ride(24 * 60), { type: "reduced", id: "r1" }, { dayCap });
    assert.deepEqual(q.discounts, [
      { code: "reduced", amount: 60000 },
      { code: "day-cap", amount: 30000 },
    ]);
    assert.equal(q.total, 30000);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 30000);
  });

  test("a custom ledger limit is used", () => {
    const dayCap = createDayCap({ limit: 1000 });
    const q = quote(ride(30), { type: "standard", id: "r1" }, { dayCap });
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 1500 }]);
    assert.equal(q.total, 1000);
  });

  test("a free ride books 0", () => {
    const dayCap = createDayCap();
    quote(ride(1), { type: "standard", id: "r1" }, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 0);
  });
});

describe("fees", () => {
  test("returning outside the zone adds 15000", () => {
    const q = quote(ride(30, { returnStation: "X01" }), standard);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(q.total, 17500);
  });

  test("out-of-zone fee applies even to a free ride", () => {
    assert.equal(quote(ride(1, { returnStation: "X02" }), standard).total, 15000);
  });

  test("out-of-zone fee is halved when the reduced fare is the plan", () => {
    const q = quote(ride(30, { returnStation: "X01" }), { type: "reduced" });
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(q.total, 1250 + 7500);
  });

  test("out-of-zone fee is full for a subscriber using the subscription", () => {
    const q = quote(ride(30, { returnStation: "X01" }), { type: "subscriber" });
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
  });

  test("out-of-zone fee is halved for a conceding subscriber when reduced wins", () => {
    const q = quote(ride(130, { returnStation: "X01" }), { type: "subscriber", concession: true });
    assert.equal(q.fees[0].amount, 7500);
  });

  test("a ride over 24 hours adds the unreturned fee of 200000", () => {
    const q = quote(ride(24 * 60 + 1), standard);
    assert.deepEqual(q.fees, [{ code: "unreturned", amount: 200000 }]);
    assert.equal(q.total, 30000 + 200000);
  });

  test("exactly 24 hours has no unreturned fee", () => {
    assert.deepEqual(quote(ride(24 * 60), standard).fees, []);
  });

  test("fees are not subject to the daily cap and stack", () => {
    const q = quote(ride(24 * 60 + 1, { returnStation: "X03" }), standard);
    assert.deepEqual(q.fees.map((f) => f.code), ["out-of-zone", "unreturned"]);
    assert.equal(q.total, 30000 + 15000 + 200000);
  });

  test("reduced rider gets the unreturned fee halved too", () => {
    const q = quote(ride(24 * 60 + 1), { type: "reduced" });
    assert.deepEqual(q.fees, [{ code: "unreturned", amount: 100000 }]);
  });

  test("custom zones lookup is used", () => {
    const zones = createZones({ Z1: { name: "Test", zone: "out" } });
    const q = quote(ride(30, { returnStation: "Z1" }), standard, { zones });
    assert.equal(q.fees[0].code, "out-of-zone");
  });
});

describe("validation", () => {
  const bad = (r, rider = standard, opts) =>
    assert.throws(() => quote(r, rider, opts), QuoteError);

  test("QuoteError is an Error with its name", () => {
    const err = new QuoteError("x");
    assert.ok(err instanceof Error);
    assert.equal(err.name, "QuoteError");
  });

  test("ride is required", () => {
    bad(undefined);
    bad(null);
    bad("ride");
  });

  test("timestamps must be ISO 8601 with an offset", () => {
    bad(ride(30, { pickupAt: "2026-01-15T10:00:00" }));
    bad(ride(30, { returnAt: "2026-01-15 10:30:00Z" }));
    bad(ride(30, { pickupAt: undefined, returnAt: PICKUP }));
    bad(ride(30, { pickupAt: 1768471200000 }));
  });

  test("impossible dates are rejected", () => {
    bad(ride(30, { pickupAt: "2026-13-45T10:00:00Z" }));
  });

  test("returnAt before pickupAt is rejected", () => {
    bad({ ...ride(30), returnAt: at(PICKUP, -1) });
  });

  test("unknown bike type is rejected", () => {
    bad(ride(30, { bike: "scooter" }));
    bad(ride(30, { bike: "toString" }));
    bad(ride(30, { bike: undefined }));
  });

  test("unknown station is rejected", () => {
    bad(ride(30, { returnStation: "S99" }));
    bad(ride(30, { returnStation: "constructor" }));
  });

  test("unknown rider type is rejected", () => {
    bad(ride(30), { type: "vip" });
    bad(ride(30), {});
    bad(ride(30), null);
    bad(ride(30), undefined);
  });

  test("a ledger requires rider.id", () => {
    bad(ride(30), { type: "standard" }, { dayCap: createDayCap() });
  });

  test("a failed validation does not touch the ledger", () => {
    const dayCap = createDayCap();
    assert.throws(() => quote(ride(30, { bike: "scooter" }), { type: "standard", id: "r1" }, { dayCap }), QuoteError);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 0);
  });
});
