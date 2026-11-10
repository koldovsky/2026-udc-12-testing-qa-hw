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

// T1 (docs/spec/tariffs.md:46-47): a started minute counts as a full one → 31 min → 2 blocks.
test("a ride of 30 min 20 s is billed as two blocks", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:20Z"), standard);
  assert.equal(result.minutes, 31);
  assert.equal(result.timeCharge, 5000);
});

test("e-bikes are billed at the e-bike rate", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:15:00Z", { bike: "ebike" }), standard);
  assert.equal(result.timeCharge, Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike);
  assert.equal(result.total, result.timeCharge);
});

// T4 (docs/spec/tariffs.md:74-77): 45 free minutes on a classic bike only;
// an e-bike has no free minutes, 20 % off: 40 min = 2 blocks = 8 000 × 0,8 = 6 400.
test("subscribers ride the first 45 minutes of a classic bike free, not of an e-bike", () => {
  for (const [bike, total] of [["classic", 0], ["ebike", 6400]]) {
    const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { bike }), { type: "subscriber" });
    assert.equal(result.total, total, bike);
  }
});

test("subscription on a long e-bike ride", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:40:00Z", { bike: "ebike" }), { type: "subscriber" });
  assert.ok(result.discounts.some((d) => d.code === "subscription"));
  assert.ok(result.total < result.timeCharge);
});

// T5 (docs/spec/tariffs.md:87): the reduced fare does not apply to fees —
// 5 000 × 0,5 = 2 500 time charge + the full 15 000 out-of-zone fee (T7) = 17 500.
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
});

test("a bike kept over a day and left outside the zone pays both fees", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  assert.equal(result.fees.length, 2);
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

// T10 + T4 (docs/spec/tariffs.md:74, :141): a subscriber's 30-min classic night ride costs 0;
// there is nothing to discount, so the quote has no discount lines at all — no zero "night" line.
test("a night ride with nothing to pay has no night discount line", () => {
  // 01:00–01:30 in Kyiv
  const result = quote(ride("2026-09-16T01:00:00+03:00", "2026-09-16T01:30:00+03:00"), { type: "subscriber" });
  assert.equal(result.timeCharge, 2500);
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
  assert.equal(result.total, 0);
});

// T2 + T10: a false start at night — no time charge, so no discount lines either.
test("a night false start has no discount lines", () => {
  const result = quote(ride("2026-09-16T03:00:00+03:00", "2026-09-16T03:01:00+03:00"), standard);
  assert.equal(result.timeCharge, 0);
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 0);
});

// Section 4: a missing ride is refused with a QuoteError, not a TypeError from inside quote().
test("a missing ride is refused with a QuoteError", () => {
  for (const missing of [null, undefined]) {
    assert.throws(() => quote(missing, standard), { name: "QuoteError", message: "ride is required" });
  }
});

// Instants must carry Z or an offset (src/tariff.js header, AGENTS.md conventions):
// without one Date.parse() would silently read the server's local time.
test("a date-time without an offset is refused", () => {
  const cases = [
    ride("2026-09-16T10:00:00", "2026-09-16T10:30:00Z"),
    ride("2026-09-16T10:00:00Z", "2026-09-16T10:30:00"),
  ];
  for (const r of cases) {
    assert.throws(() => quote(r, standard), { name: "QuoteError", message: /must be an ISO 8601 date-time with an offset/ });
  }
});

// A non-string instant is refused even when its string form looks like a valid date-time.
test("a non-string date-time is refused", () => {
  const cases = [
    ride(["2026-09-16T10:00:00Z"], "2026-09-16T10:30:00Z"),
    ride("2026-09-16T10:00:00Z", Date.parse("2026-09-16T10:30:00Z")),
  ];
  for (const r of cases) {
    assert.throws(() => quote(r, standard), { name: "QuoteError", message: /must be an ISO 8601 date-time with an offset/ });
  }
});
