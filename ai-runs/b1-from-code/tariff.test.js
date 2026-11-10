const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const SRC = "../../app/src/";

async function loadTariff() {
  return await import(SRC + "tariff.js");
}
async function loadZones() {
  return await import(SRC + "zones.js");
}

const baseRide = {
  pickupAt: "2026-01-15T10:00:00+02:00",
  returnAt: "2026-01-15T10:30:00+02:00",
  bike: "classic",
  returnStation: "S01",
};
const stdRider = { type: "standard" };

async function zones() {
  return (await loadZones()).stationZones;
}

describe("tariff.quote", () => {
  test("30-minute classic ride for a standard rider costs one block", async () => {
    const { quote, RATES } = await loadTariff();
    const res = quote(baseRide, stdRider, { zones: await zones() });
    assert.strictEqual(res.minutes, 30);
    assert.strictEqual(res.timeCharge, RATES.classic);
    assert.deepStrictEqual(res.discounts, []);
    assert.deepStrictEqual(res.fees, []);
    assert.strictEqual(res.total, RATES.classic);
  });

  test("31 minutes round up to two blocks", async () => {
    const { quote, RATES } = await loadTariff();
    const res = quote(
      { ...baseRide, returnAt: "2026-01-15T10:31:00+02:00" },
      stdRider,
      { zones: await zones() },
    );
    assert.strictEqual(res.minutes, 31);
    assert.strictEqual(res.timeCharge, RATES.classic * 2);
    assert.strictEqual(res.total, RATES.classic * 2);
  });

  test("ride shorter than 2 minutes is free", async () => {
    const { quote } = await loadTariff();
    const res = quote(
      { ...baseRide, returnAt: "2026-01-15T10:01:00+02:00" },
      stdRider,
      { zones: await zones() },
    );
    assert.strictEqual(res.minutes, 1);
    assert.strictEqual(res.timeCharge, 0);
    assert.strictEqual(res.total, 0);
  });

  test("ebike costs more per block", async () => {
    const { quote, RATES } = await loadTariff();
    const res = quote(
      { ...baseRide, bike: "ebike", returnAt: "2026-01-15T10:45:00+02:00" },
      stdRider,
      { zones: await zones() },
    );
    assert.strictEqual(res.minutes, 45);
    assert.strictEqual(res.timeCharge, RATES.ebike * 2);
    assert.strictEqual(res.total, RATES.ebike * 2);
  });

  test("discount() helper: percent off rounded down to the kopeck", async () => {
    const { discount } = await loadTariff();
    assert.strictEqual(discount(1000, 50), 500);
    assert.strictEqual(discount(1000, 30), 300);
    assert.strictEqual(discount(1000, 20), 200);
    assert.strictEqual(discount(2500, 50), 1250);
  });

  test("reduced rider gets 50% off the time charge", async () => {
    const { quote } = await loadTariff();
    const res = quote(baseRide, { type: "reduced" }, { zones: await zones() });
    assert.strictEqual(res.timeCharge, 2500);
    assert.deepStrictEqual(res.discounts, [{ code: "reduced", amount: 1250 }]);
    assert.strictEqual(res.total, 1250);
  });

  test("subscriber pays only for minutes beyond the free 45", async () => {
    const { quote } = await loadTariff();
    const res = quote(
      { ...baseRide, returnAt: "2026-01-15T11:00:00+02:00" },
      { type: "subscriber" },
      { zones: await zones() },
    );
    // 60 min: timeCharge 5000; subscription charge for 15 min over free = 2500; discount 2500
    assert.strictEqual(res.timeCharge, 5000);
    assert.deepStrictEqual(res.discounts, [{ code: "subscription", amount: 2500 }]);
    assert.strictEqual(res.total, 2500);
  });

  test("subscriber with concession on ebike picks the cheaper plan", async () => {
    const { quote } = await loadTariff();
    const res = quote(
      { ...baseRide, bike: "ebike", returnAt: "2026-01-15T11:00:00+02:00" },
      { type: "subscriber", concession: true },
      { zones: await zones() },
    );
    // timeCharge 8000; subscription: 4000 less 20% = 3200 -> discount 4800;
    // reduced: 50% of 8000 = 4000; subscription wins
    assert.deepStrictEqual(res.discounts, [{ code: "subscription", amount: 4800 }]);
    assert.strictEqual(res.total, 3200);
  });

  test("night ride (before 06:00 Kyiv) gets a 30% discount", async () => {
    const { quote } = await loadTariff();
    // 03:00 Z = 05:00 Kyiv in January (UTC+2)
    const res = quote(
      { ...baseRide, pickupAt: "2026-01-15T03:00:00Z", returnAt: "2026-01-15T04:00:00Z" },
      stdRider,
      { zones: await zones() },
    );
    assert.strictEqual(res.timeCharge, 5000);
    assert.deepStrictEqual(res.discounts, [{ code: "night", amount: 1500 }]);
    assert.strictEqual(res.total, 3500);
  });

  test("morning ride has no night discount", async () => {
    const { quote } = await loadTariff();
    // 08:00 Z = 10:00 Kyiv
    const res = quote(
      { ...baseRide, pickupAt: "2026-01-15T08:00:00Z", returnAt: "2026-01-15T09:00:00Z" },
      stdRider,
      { zones: await zones() },
    );
    assert.ok(!res.discounts.some((d) => d.code === "night"));
    assert.strictEqual(res.total, 5000);
  });

  test("out-of-zone return station adds a fee", async () => {
    const { quote } = await loadTariff();
    const res = quote({ ...baseRide, returnStation: "X01" }, stdRider, { zones: await zones() });
    assert.deepStrictEqual(res.fees, [{ code: "out-of-zone", amount: 15000 }]);
    assert.strictEqual(res.total, 2500 + 15000);
  });

  test("unreturned bike after 24 hours adds a fee", async () => {
    const { quote } = await loadTariff();
    const res = quote({ ...baseRide, returnAt: "2026-01-16T11:00:00+02:00" }, stdRider, { zones: await zones() });
    // 25 hours = 1500 minutes > 1440; without a dayCap ledger the allowance is DAY_CAP (30000)
    assert.ok(res.minutes > 1440);
    assert.deepStrictEqual(res.fees, [{ code: "unreturned", amount: 200000 }]);
    assert.strictEqual(res.total, 30000 + 200000);
  });

  test("day cap discounts the part above the remaining allowance", async () => {
    const { createDayCap } = await import(SRC + "day-cap.js");
    const { quote } = await loadTariff();
    const dayCap = createDayCap({ limit: 5000 });
    const rider = { type: "standard", id: "r1" };

    const r1 = quote(
      { ...baseRide, returnAt: "2026-01-15T10:30:00+02:00" },
      rider,
      { zones: await zones(), dayCap },
    );
    assert.strictEqual(r1.total, 2500);

    const r2 = quote(
      { ...baseRide, returnAt: "2026-01-15T11:00:00+02:00" },
      rider,
      { zones: await zones(), dayCap },
    );
    assert.strictEqual(r2.total, 2500);

    const r3 = quote(
      { ...baseRide, returnAt: "2026-01-15T11:30:00+02:00" },
      rider,
      { zones: await zones(), dayCap },
    );
    // remaining is 0; the whole 90-minute charge (7500) is covered by the day-cap discount
    assert.strictEqual(r3.total, 0);
    const dayCapDiscount = r3.discounts.find((d) => d.code === "day-cap");
    assert.ok(dayCapDiscount);
    assert.strictEqual(dayCapDiscount.amount, 7500);
  });

  test("different days are tracked separately by the day cap", async () => {
    const { createDayCap } = await import(SRC + "day-cap.js");
    const { quote } = await loadTariff();
    const dayCap = createDayCap({ limit: 5000 });
    const rider = { type: "standard", id: "r1" };

    const r1 = quote(
      { ...baseRide, pickupAt: "2026-01-15T22:00:00+02:00", returnAt: "2026-01-15T22:30:00+02:00" },
      rider,
      { zones: await zones(), dayCap },
    );
    // 22:00 +02:00 = 20:00 Z, day 2026-01-15
    assert.strictEqual(r1.total, 2500);

    const r2 = quote(
      { ...baseRide, pickupAt: "2026-01-16T10:00:00+02:00", returnAt: "2026-01-16T10:30:00+02:00" },
      rider,
      { zones: await zones(), dayCap },
    );
    // 10:00 +02:00 = 08:00 Z, day 2026-01-16 (not a night hour)
    assert.strictEqual(r2.total, 2500);
  });

  test("requires rider.id when a day cap ledger is given", async () => {
    const { quote } = await loadTariff();
    const { createDayCap } = await import(SRC + "day-cap.js");
    const dayCap = createDayCap();
    const z = await zones();
    assert.throws(
      () => quote(baseRide, { type: "standard" }, { zones: z, dayCap }),
      { name: "QuoteError", message: "rider.id is required with a daily cap ledger" },
    );
  });

  test("unknown bike type throws", async () => {
    const { quote } = await loadTariff();
    const z = await zones();
    assert.throws(
      () => quote({ ...baseRide, bike: "scooter" }, stdRider, { zones: z }),
      { name: "QuoteError", message: "unknown bike type: scooter" },
    );
  });

  test("returnAt before pickupAt throws", async () => {
    const { quote } = await loadTariff();
    const z = await zones();
    assert.throws(
      () =>
        quote(
          { ...baseRide, pickupAt: "2026-01-15T10:30:00+02:00", returnAt: "2026-01-15T10:00:00+02:00" },
          stdRider,
          { zones: z },
        ),
      { name: "QuoteError", message: "returnAt is before pickupAt" },
    );
  });

  test("unknown station throws", async () => {
    const { quote } = await loadTariff();
    const z = await zones();
    assert.throws(
      () => quote({ ...baseRide, returnStation: "S99" }, stdRider, { zones: z }),
      { name: "QuoteError", message: "unknown station: S99" },
    );
  });

  test("invalid date-time throws", async () => {
    const { quote } = await loadTariff();
    const z = await zones();
    assert.throws(
      () => quote({ ...baseRide, pickupAt: "not-a-date" }, stdRider, { zones: z }),
      { name: "QuoteError" },
    );
  });

  test("unknown rider type throws", async () => {
    const { quote } = await loadTariff();
    const z = await zones();
    assert.throws(
      () => quote(baseRide, { type: "vip" }, { zones: z }),
      { name: "QuoteError", message: "unknown rider type: vip" },
    );
  });

  test("custom zones lookup can be passed in", async () => {
    const { quote } = await loadTariff();
    const customZones = { zoneOf: () => null };
    assert.throws(
      () => quote(baseRide, stdRider, { zones: customZones }),
      { name: "QuoteError", message: "unknown station: S01" },
    );
  });
});
