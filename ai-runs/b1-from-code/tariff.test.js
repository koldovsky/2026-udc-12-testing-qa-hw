import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { quote, discount, QuoteError, RATES } from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";
import { createZones } from "../../app/src/zones.js";

const PICKUP = "2026-01-15T12:00:00+02:00"; // daytime in Kyiv (winter, UTC+2)

function ride({ minutes = 30, bike = "classic", station = "S01", pickupAt = PICKUP } = {}) {
  const returnAt = new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString();
  return { pickupAt, returnAt, bike, returnStation: station };
}
const standard = { type: "standard", id: "r1" };
const reduced = { type: "reduced", id: "r1" };
const subscriber = { type: "subscriber", id: "r1" };

describe("discount()", () => {
  test("percent off, remainder rounded down to the kopeck (discount rounds up)", () => {
    assert.equal(discount(2500, 30), 750);
    assert.equal(discount(1, 50), 1);
    assert.equal(discount(2501, 50), 1251);
  });
  test("0% and 100%", () => {
    assert.equal(discount(1234, 0), 0);
    assert.equal(discount(1234, 100), 1234);
  });
});

describe("time charge", () => {
  test("rides shorter than 2 minutes are free", () => {
    for (const m of [0, 1]) {
      const q = quote(ride({ minutes: m }), standard);
      assert.equal(q.timeCharge, 0);
      assert.equal(q.total, 0);
    }
  });

  test("2 minutes is already a full block", () => {
    assert.equal(quote(ride({ minutes: 2 }), standard).timeCharge, RATES.classic);
  });

  test("block boundaries: 30 min = 1 block, 31 min = 2 blocks", () => {
    assert.equal(quote(ride({ minutes: 30 }), standard).timeCharge, 2500);
    assert.equal(quote(ride({ minutes: 31 }), standard).timeCharge, 5000);
    assert.equal(quote(ride({ minutes: 60 }), standard).timeCharge, 5000);
    assert.equal(quote(ride({ minutes: 61 }), standard).timeCharge, 7500);
  });

  test("ebike uses its own rate", () => {
    const q = quote(ride({ minutes: 31, bike: "ebike" }), standard);
    assert.equal(q.timeCharge, 8000);
    assert.equal(q.total, 8000);
  });

  test("result shape for a plain ride", () => {
    assert.deepEqual(quote(ride({ minutes: 30 }), standard), {
      minutes: 30,
      timeCharge: 2500,
      discounts: [],
      fees: [],
      total: 2500,
    });
  });

  test("seconds are rounded to the nearest minute", () => {
    const base = Date.parse(PICKUP);
    const mk = (sec) => ({
      pickupAt: PICKUP,
      returnAt: new Date(base + sec * 1000).toISOString(),
      bike: "classic",
      returnStation: "S01",
    });
    assert.equal(quote(mk(29 * 60 + 29), standard).minutes, 29);
    assert.equal(quote(mk(29 * 60 + 30), standard).minutes, 30);
    assert.equal(quote(mk(90), standard).minutes, 2); // 1.5 min rounds to 2 -> not free
  });

  test("offsets are honoured: same instant in different offsets", () => {
    const q = quote(
      { pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T12:30:00+02:00", bike: "classic", returnStation: "S01" },
      standard,
    );
    assert.equal(q.minutes, 30);
  });
});

describe("reduced fare", () => {
  test("50% off the time charge", () => {
    const q = quote(ride({ minutes: 60 }), reduced);
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 2500 }]);
    assert.equal(q.total, 2500);
  });

  test("odd amounts: what is left is rounded down", () => {
    // ebike 1 block = 4000 -> 2000; a 2501 case is covered in discount(); here check classic 1 block
    const q = quote(ride({ minutes: 30 }), reduced);
    assert.equal(q.total, 1250);
  });

  test("free ride adds no discount entry", () => {
    const q = quote(ride({ minutes: 1 }), reduced);
    assert.deepEqual(q.discounts, []);
  });
});

describe("subscription", () => {
  test("first 45 minutes are free", () => {
    for (const m of [30, 45]) {
      const q = quote(ride({ minutes: m }), subscriber);
      assert.equal(q.total, 0, `${m} min`);
    }
    const q = quote(ride({ minutes: 45 }), subscriber);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5000 }]);
  });

  test("46 minutes: one billable block", () => {
    const q = quote(ride({ minutes: 46 }), subscriber);
    assert.equal(q.timeCharge, 5000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.equal(q.total, 2500);
  });

  test("ebike gets an extra 20% off the billable part", () => {
    const q = quote(ride({ minutes: 76, bike: "ebike" }), subscriber);
    assert.equal(q.timeCharge, 12000);
    assert.deepEqual(q.discounts, [{ code: "subscription", amount: 5600 }]);
    assert.equal(q.total, 6400);
  });

  test("subscriber without concession does not get the reduced fare", () => {
    const q = quote(ride({ minutes: 120 }), subscriber);
    assert.equal(q.discounts[0].code, "subscription");
    assert.equal(q.total, 7500);
  });

  test("concession: the cheaper of subscription and reduced is applied, not both", () => {
    const q = quote(ride({ minutes: 120 }), { ...subscriber, concession: true });
    assert.deepEqual(q.discounts, [{ code: "reduced", amount: 5000 }]);
    assert.equal(q.total, 5000);
  });

  test("concession: subscription wins when it is cheaper", () => {
    const q = quote(ride({ minutes: 45 }), { ...subscriber, concession: true });
    assert.equal(q.discounts[0].code, "subscription");
    assert.equal(q.total, 0);
  });

  test("concession flag is ignored for standard riders", () => {
    const q = quote(ride({ minutes: 60 }), { ...standard, concession: true });
    assert.deepEqual(q.discounts, []);
    assert.equal(q.total, 5000);
  });
});

describe("night discount", () => {
  test("30% off for pickups before 06:00 Kyiv time", () => {
    const q = quote(ride({ minutes: 30, pickupAt: "2026-01-15T03:00:00+02:00" }), standard);
    assert.deepEqual(q.discounts, [{ code: "night", amount: 750 }]);
    assert.equal(q.total, 1750);
  });

  test("05:59 is night, 06:00 is not", () => {
    const at = (t) => quote(ride({ minutes: 30, pickupAt: t }), standard);
    assert.equal(at("2026-01-15T05:59:00+02:00").total, 1750);
    assert.equal(at("2026-01-15T06:00:00+02:00").total, 2500);
  });

  test("uses Kyiv wall-clock regardless of the offset in the string (winter)", () => {
    // 03:00Z = 05:00 Kyiv (night); 04:00Z = 06:00 Kyiv (day)
    assert.equal(quote(ride({ minutes: 30, pickupAt: "2026-01-15T03:00:00Z" }), standard).total, 1750);
    assert.equal(quote(ride({ minutes: 30, pickupAt: "2026-01-15T04:00:00Z" }), standard).total, 2500);
  });

  test("uses Kyiv summer time (UTC+3)", () => {
    // 02:00Z = 05:00 Kyiv in July (night); 03:00Z = 06:00 Kyiv (day)
    assert.equal(quote(ride({ minutes: 30, pickupAt: "2026-07-15T02:00:00Z" }), standard).total, 1750);
    assert.equal(quote(ride({ minutes: 30, pickupAt: "2026-07-15T03:00:00Z" }), standard).total, 2500);
  });

  test("no night entry on a free ride", () => {
    const q = quote(ride({ minutes: 1, pickupAt: "2026-01-15T03:00:00+02:00" }), standard);
    assert.deepEqual(q.discounts, []);
  });

  test("no night entry when subscription already makes it free", () => {
    const q = quote(ride({ minutes: 30, pickupAt: "2026-01-15T03:00:00+02:00" }), subscriber);
    assert.deepEqual(q.discounts.map((d) => d.code), ["subscription"]);
    assert.equal(q.total, 0);
  });

  test("night applies after the plan discount", () => {
    // reduced: 5000 -> 2500; night 30% of 2500 = 750 -> 1750
    const q = quote(ride({ minutes: 60, pickupAt: "2026-01-15T03:00:00+02:00" }), reduced);
    assert.deepEqual(q.discounts, [
      { code: "reduced", amount: 2500 },
      { code: "night", amount: 750 },
    ]);
    assert.equal(q.total, 1750);
  });
});

describe("fees", () => {
  test("out-of-zone return adds 15000", () => {
    const q = quote(ride({ minutes: 30, station: "X01" }), standard);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.equal(q.total, 17500);
  });

  test("out-of-zone fee applies even to a free ride", () => {
    assert.equal(quote(ride({ minutes: 1, station: "X02" }), standard).total, 15000);
  });

  test("reduced fare halves fees too", () => {
    const q = quote(ride({ minutes: 30, station: "X03" }), reduced);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 7500 }]);
    assert.equal(q.total, 1250 + 7500);
  });

  test("subscription does not reduce fees", () => {
    const q = quote(ride({ minutes: 30, station: "X03" }), subscriber);
    assert.deepEqual(q.fees, [{ code: "out-of-zone", amount: 15000 }]);
  });

  test("unreturned fee only above 24 h (1440 min exactly is fine)", () => {
    assert.deepEqual(quote(ride({ minutes: 1440 }), standard).fees, []);
    const q = quote(ride({ minutes: 1441 }), standard);
    assert.deepEqual(q.fees, [{ code: "unreturned", amount: 200000 }]);
  });

  test("unreturned fee is not subject to the day cap; time charge is", () => {
    const q = quote(ride({ minutes: 1441 }), standard);
    assert.equal(q.timeCharge, 49 * 2500);
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 49 * 2500 - 30000 }]);
    assert.equal(q.total, 30000 + 200000);
  });

  test("both fees together, halved for reduced", () => {
    const q = quote(ride({ minutes: 1441, station: "X01" }), reduced);
    assert.deepEqual(q.fees, [
      { code: "out-of-zone", amount: 7500 },
      { code: "unreturned", amount: 100000 },
    ]);
  });
});

describe("daily cap without a ledger", () => {
  test("time charge is capped at 30000", () => {
    const q = quote(ride({ minutes: 360 }), standard); // 12 blocks = 30000 exactly
    assert.deepEqual(q.discounts, []);
    assert.equal(q.total, 30000);
    const q2 = quote(ride({ minutes: 361 }), standard); // 13 blocks = 32500
    assert.deepEqual(q2.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(q2.total, 30000);
  });

  test("rider.id is not required without a ledger", () => {
    assert.doesNotThrow(() => quote(ride(), { type: "standard" }));
  });
});

describe("daily cap with a ledger", () => {
  test("rider.id is required", () => {
    assert.throws(() => quote(ride(), { type: "standard" }, { dayCap: createDayCap() }), QuoteError);
  });

  test("second ride the same day is billed only up to the remainder", () => {
    const dayCap = createDayCap();
    const first = quote(ride({ minutes: 300 }), standard, { dayCap }); // 10 blocks = 25000
    assert.equal(first.total, 25000);
    const second = quote(ride({ minutes: 120 }), standard, { dayCap }); // 10000, only 5000 left
    assert.deepEqual(second.discounts, [{ code: "day-cap", amount: 5000 }]);
    assert.equal(second.total, 5000);
    const third = quote(ride({ minutes: 30 }), standard, { dayCap });
    assert.equal(third.total, 0);
    assert.deepEqual(third.discounts, [{ code: "day-cap", amount: 2500 }]);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 30000);
  });

  test("books the discounted amount, not the raw time charge", () => {
    const dayCap = createDayCap();
    quote(ride({ minutes: 60 }), reduced, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 2500);
  });

  test("another rider and another day are unaffected", () => {
    const dayCap = createDayCap();
    quote(ride({ minutes: 360 }), standard, { dayCap });
    assert.equal(quote(ride({ minutes: 30 }), { type: "standard", id: "r2" }, { dayCap }).total, 2500);
    const nextDay = ride({ minutes: 30, pickupAt: "2026-01-16T12:00:00+02:00" });
    assert.equal(quote(nextDay, standard, { dayCap }).total, 2500);
  });

  test("fees are not booked into the cap", () => {
    const dayCap = createDayCap();
    quote(ride({ minutes: 30, station: "X01" }), standard, { dayCap });
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 2500);
  });

  test("a rejected quote does not book anything", () => {
    const dayCap = createDayCap();
    assert.throws(() => quote(ride({ station: "NOPE" }), standard, { dayCap }), QuoteError);
    assert.equal(dayCap.chargedOn("r1", "2026-01-15"), 0);
  });

  test("night discount is applied before the cap", () => {
    // 360 min classic = 30000, night -> 21000 (below cap), booked 21000
    const dayCap = createDayCap();
    const q = quote(ride({ minutes: 360, pickupAt: "2026-01-15T03:00:00+02:00" }), standard, { dayCap });
    assert.deepEqual(q.discounts, [{ code: "night", amount: 9000 }]);
    assert.equal(q.total, 21000);
    assert.equal(dayCap.remaining("r1", Date.parse("2026-01-15T03:00:00+02:00")), 9000);
  });

  test("custom ledger limit", () => {
    const dayCap = createDayCap({ limit: 1000 });
    const q = quote(ride({ minutes: 30 }), standard, { dayCap });
    assert.deepEqual(q.discounts, [{ code: "day-cap", amount: 1500 }]);
    assert.equal(q.total, 1000);
  });
});

describe("custom zones", () => {
  test("quote uses the supplied zone lookup", () => {
    const zones = createZones({ A: { name: "a", zone: "out" } });
    const q = quote(ride({ minutes: 30, station: "A" }), standard, { zones });
    assert.equal(q.fees[0].code, "out-of-zone");
    assert.throws(() => quote(ride({ station: "S01" }), standard, { zones }), QuoteError);
  });
});

describe("validation", () => {
  const bad = (r, who = standard, opts) => assert.throws(() => quote(r, who, opts), QuoteError);

  test("missing ride", () => {
    bad(undefined);
    bad(null);
    bad("ride");
  });

  test("malformed or offset-less timestamps", () => {
    bad({ ...ride(), pickupAt: "2026-01-15T12:00:00" }); // no offset
    bad({ ...ride(), pickupAt: "2026-01-15" });
    bad({ ...ride(), returnAt: 12345 });
    bad({ ...ride(), returnAt: undefined });
    bad({ ...ride(), pickupAt: "2026-13-45T12:00:00Z" }); // regex ok, Date.parse NaN
  });

  test("return before pickup", () => {
    bad({ ...ride(), returnAt: "2026-01-15T11:59:00+02:00" });
  });

  test("return equal to pickup is allowed (0 minutes)", () => {
    const q = quote({ ...ride(), returnAt: PICKUP }, standard);
    assert.equal(q.minutes, 0);
    assert.equal(q.total, 0);
  });

  test("unknown bike, including inherited property names", () => {
    bad(ride({ bike: "scooter" }));
    bad(ride({ bike: "toString" }));
    bad({ ...ride(), bike: undefined });
  });

  test("unknown station", () => {
    bad(ride({ station: "S99" }));
    bad({ ...ride(), returnStation: undefined });
    bad(ride({ station: "constructor" }));
  });

  test("unknown rider type", () => {
    bad(ride(), { type: "vip", id: "r1" });
    bad(ride(), "subscriber");
    bad(ride(), null);
    bad(ride(), {});
  });

  test("QuoteError is an Error with its own name", () => {
    try {
      quote(null, standard);
      assert.fail("should throw");
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.equal(e.name, "QuoteError");
    }
  });
});
