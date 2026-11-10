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
  for (const r of rides) {
    const result = quote(r, standard);
    assert.ok(result.total >= 0);
    assert.ok(Array.isArray(result.discounts));
    assert.ok(Array.isArray(result.fees));
    assert.equal(typeof result.minutes, "number");
  }
});

test("a ride of 30 min 20 s is billed as 31 minutes → 2 blocks (T1)", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:20Z"), standard);
  // T1: неповна хвилина рахується як повна → 30 хв 20 с = 31 хв → ceil(31/30)=2 блоки → 50 грн
  assert.equal(result.minutes, 31);
  assert.equal(result.timeCharge, 5000);
});

test("e-bikes are billed at the e-bike rate", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:15:00Z", { bike: "ebike" }), standard);
  assert.equal(result.timeCharge, Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike);
  assert.equal(result.total, result.timeCharge);
});

test("subscribers: a classic ride keeps the first 45 minutes free (T4)", () => {
  const classic = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z"), { type: "subscriber" });
  assert.equal(classic.total, 0);
});

test("subscribers: an e-bike ride has no free minutes and pays 20 % less than T3 (T4)", () => {
  const ebike = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { bike: "ebike" }), { type: "subscriber" });
  // T4: для електровелосипеда безкоштовних хвилин немає → ceil(40/30)=2 блоки × 4000 = 8000; −20% → 6400
  assert.equal(ebike.total, 6400);
});

test("subscription on a long e-bike ride", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:40:00Z", { bike: "ebike" }), { type: "subscriber" });
  assert.ok(result.discounts.some((d) => d.code === "subscription"));
  assert.ok(result.total < result.timeCharge);
});

test("reduced fare for a ride returned outside the zone", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { returnStation: "X01" }), { type: "reduced" });
  assert.equal(result.total, 10000);
  assert.equal(result.fees[0].amount, 7500);
});

test("night rides get 30 % off", () => {
  // 01:10–01:40 in Kyiv
  const result = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:40:00Z"), standard);
  assert.equal(result.timeCharge, 2500);
  assert.deepEqual(result.discounts, [{ code: "night", amount: 750 }]);
  assert.equal(result.total, 1750);
});

test("a bike kept over a day and left outside the zone pays both fees", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  assert.deepEqual(result.fees, [
    { code: "out-of-zone", amount: 15000 },
    { code: "unreturned", amount: 200000 },
  ]);
  // 48 h classic = 96 blocks × 2500 = 240000; T6 caps the time charge at 30000;
  // fees 15000 + 200000 → total 245000.
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
});

test("a 45-minute classic ride costs 50 UAH", () => {
  const priceRide = mock.fn(() => ({ minutes: 45, timeCharge: 5000, discounts: [], fees: [], total: 5000 }));
  const result = priceRide(ride("2026-09-16T07:00:00Z", "2026-09-16T07:45:00Z"), standard);
  assert.equal(result.total, 5000);
  assert.equal(priceRide.mock.callCount(), 1);
});

test("a return before the pickup is rejected", () => {
  assert.throws(() => quote(ride("2026-09-16T08:00:00Z", "2026-09-16T07:00:00Z"), standard), QuoteError);
});

test("a zero-minute ride (pickup === return) is allowed and free", () => {
  const result = quote(ride("2026-09-16T10:00:00Z", "2026-09-16T10:00:00Z"), standard);
  assert.equal(result.minutes, 0);
  assert.equal(result.total, 0);
});

test("a non-object ride is rejected with 'ride is required'", () => {
  assert.throws(() => quote("not a ride", standard), /ride is required/);
});

test("an invalid rider type is rejected with 'unknown rider type'", () => {
  assert.throws(
    () => quote(ride("2026-09-16T10:00:00Z", "2026-09-16T10:10:00Z"), { type: "bogus" }),
    /unknown rider type: bogus/,
  );
});

test("a non-ISO pickupAt string is rejected with the ISO message", () => {
  assert.throws(
    () => quote(ride("not-a-date", "2026-09-16T10:10:00Z"), standard),
    /pickupAt must be an ISO 8601/,
  );
});

// Boundary: the unreturned fee applies only strictly after 24 h (1440 min).
test("a ride of exactly 24 h = 1440 min does NOT pay the unreturned fee", () => {
  const result = quote(ride("2026-09-16T10:00:00Z", "2026-09-17T10:00:00Z"), standard);
  assert.equal(result.minutes, 1440);
  assert.equal(result.total, DAY_CAP);
  assert.deepEqual(result.fees, []);
  // 1440 min = 48 blocks × 2500 = 120000 kop; T6 caps the time charge at 30000.
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 90000 }]);
});

test("a ride of 24 h 1 min = 1441 min pays the unreturned fee", () => {
  const result = quote(ride("2026-09-16T10:00:00Z", "2026-09-17T10:01:00Z"), standard);
  assert.equal(result.minutes, 1441);
  assert.deepEqual(result.fees, [{ code: "unreturned", amount: 200000 }]);
  assert.equal(result.total, DAY_CAP + 200000);
});

// Boundary: the day cap applies only strictly above the allowance.
test("a ride whose due equals the day-cap allowance gets no day-cap discount", () => {
  const dayCap = createDayCap();
  // classic 360 min = 12 blocks × 2500 = 30000 == DAY_CAP
  const result = quote(
    ride("2026-09-16T10:00:00Z", "2026-09-16T16:00:00Z"),
    { id: "rider-cap", type: "standard" },
    { dayCap },
  );
  assert.equal(result.minutes, 360);
  assert.equal(result.timeCharge, DAY_CAP);
  assert.equal(result.total, DAY_CAP);
  assert.deepEqual(result.discounts, []);
  assert.deepEqual(result.fees, []);
});

// Boundary: the night discount applies only when something is still due.
test("a night ride that is already free gets no night discount entry", () => {
  // Kyiv 01:10 (night), subscriber classic 40 min → subscription covers all, due = 0
  const result = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:50:00Z"), { type: "subscriber" });
  assert.equal(result.total, 0);
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 5000 }]);
  assert.deepEqual(result.fees, []);
});

// Boundary: one millisecond over a block boundary still rounds up to the next minute.
test("30 min 1 ms is billed as 31 minutes → 2 blocks (T1)", () => {
  const result = quote(ride("2026-09-16T10:00:00Z", "2026-09-16T10:30:00.001Z"), standard);
  assert.equal(result.minutes, 31);
  assert.equal(result.timeCharge, 5000);
});
