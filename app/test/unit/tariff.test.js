import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP } from "../../src/day-cap.js";
import { BLOCK_MINUTES, QuoteError, RATES, quote } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, extra = {}) => ({ pickupAt, returnAt, bike: "classic", returnStation: "S01", ...extra });
const standard = { type: "standard" };

test("quote returns an itemised price", () => {
  const rides = [
    ride("2026-09-16T07:00:00Z", "2026-09-16T07:01:00Z"),
    ride("2026-09-16T07:00:00Z", "2026-09-16T07:50:00Z"),
    ride("2026-09-16T07:00:00Z", "2026-09-16T09:10:00Z", { bike: "ebike" }),
  ];
  // free start (docs/spec/tariffs.md:54, 57); 2 blocks × 25 UAH (:69); 5 blocks × 40 UAH (:62, 67)
  const totals = [0, 5000, 20000];
  for (const [i, r] of rides.entries()) {
    const result = quote(r, standard);
    assert.equal(result.total, totals[i]);
    assert.ok(result.total >= 0);
    assert.ok(Array.isArray(result.discounts));
    assert.ok(Array.isArray(result.fees));
    assert.equal(typeof result.minutes, "number");
  }
});

test("a ride of 30 min 20 s is billed as two blocks", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:20Z"), standard);
  assert.equal(result.minutes, 31);
  assert.equal(result.timeCharge, 5000);
});

test("e-bikes are billed at the e-bike rate", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:15:00Z", { bike: "ebike" }), standard);
  assert.equal(result.timeCharge, Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike);
  assert.equal(result.timeCharge, 12000); // 75 min → 3 blocks × 40 UAH, docs/spec/tariffs.md:70
  assert.equal(result.total, result.timeCharge);
});

test("subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off", () => {
  for (const [bike, total] of [["classic", 0], ["ebike", 6400]]) {
    const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { bike }), { type: "subscriber" });
    assert.equal(result.total, total);
  }
});

test("subscription on a long e-bike ride", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:40:00Z", { bike: "ebike" }), { type: "subscriber" });
  assert.ok(result.discounts.some((d) => d.code === "subscription"));
  assert.ok(result.total < result.timeCharge);
  // 100 min → 4 blocks × 40 UAH = 160 UAH, 20 % off (docs/spec/tariffs.md:62, 67, 76)
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 3200 }]);
  assert.equal(result.total, 12800);
});

test("reduced fare for a ride returned outside the zone", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { returnStation: "X01" }), { type: "reduced" });
  assert.equal(result.total, 17500);
  assert.equal(result.fees[0].amount, 15000);
});

test("night rides get 30 % off", () => {
  // 01:10–01:40 in Kyiv
  const result = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:40:00Z"), standard);
  assert.equal(result.timeCharge, 2500);
  assert.equal(result.discounts.length, 1);
  assert.equal(result.discounts[0].code, "night");
  assert.ok(result.total < result.timeCharge);
  assert.equal(result.discounts[0].amount, 750); // 30 % of 2500, docs/spec/tariffs.md:141
  assert.equal(result.total, 1750); // docs/spec/tariffs.md:143
});

test("a bike kept over a day and left outside the zone pays both fees", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  assert.equal(result.fees.length, 2);
  // Both fees apply, in no fixed order (docs/spec/tariffs.md:121-122, 133-135): compared by code.
  assert.deepEqual(Object.fromEntries(result.fees.map((fee) => [fee.code, fee.amount])), {
    "out-of-zone": 15000,
    unreturned: 200000,
  });
  // 48 h: time charge capped at 300 UAH, plus 150 UAH and 2 000 UAH (docs/spec/tariffs.md:112, 120, 124-125)
  assert.equal(result.total, 245000);
});

test("the daily cap limits the time charge", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-7", type: "standard" };
  let last;
  for (const [from, to] of [["06:00", "07:20"], ["10:00", "11:20"], ["15:00", "16:20"]]) {
    last = quote(ride(`2026-09-16T${from}:00Z`, `2026-09-16T${to}:00Z`, { bike: "ebike" }), rider, { dayCap });
  }
  assert.ok(last.total <= DAY_CAP);
  // 80 min on an e-bike is 120 UAH; two rides leave 60 UAH of the cap for the third (docs/spec/tariffs.md:105-106)
  assert.equal(last.total, 6000);
  assert.deepEqual(last.discounts, [{ code: "day-cap", amount: 6000 }]);
  assert.equal(dayCap.chargedOn("rider-7", "2026-09-16"), 30000); // docs/spec/tariffs.md:105-106
});

test("a 45-minute classic ride costs 50 UAH", () => {
  const priceRide = mock.fn(quote);
  const result = priceRide(ride("2026-09-16T07:00:00Z", "2026-09-16T07:45:00Z"), standard);
  assert.equal(result.total, 5000);
  assert.equal(priceRide.mock.callCount(), 1);
});

test("a return before the pickup is rejected", () => {
  assert.throws(() => quote(ride("2026-09-16T08:00:00Z", "2026-09-16T07:00:00Z"), standard), QuoteError);
});

test("a missing ride is rejected with a QuoteError", () => {
  for (const missing of [null, undefined]) {
    assert.throws(() => quote(missing, standard), QuoteError);
  }
});
