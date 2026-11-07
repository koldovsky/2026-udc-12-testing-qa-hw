import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { QuoteError, quote } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, extra = {}) => ({ pickupAt, returnAt, bike: "classic", returnStation: "S01", ...extra });
const standard = { type: "standard" };

// One test per ride, so that a failing ride does not hide the others (app/AGENTS.md, rule 5). Every
// ride is by a standard rider by day, ends at S01 in the zone and lasts under 24 h: no fee
// (docs/spec/tariffs.md:112, 119, 166). Durations are whole minutes (:45-47).
test("T1, T2: quote returns an itemised price: classic, 1 min is a false start", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:01:00Z"), standard);
  assert.equal(result.minutes, 1);
  assert.equal(result.total, 0); // free start (docs/spec/tariffs.md:54, 57)
  assert.deepEqual(result.fees, []);
  // No discount asserted: what a false start shows as a discount is Q-4 (docs/test-cases.md:162).
});

const itemised = [
  // 2 blocks × 25 UAH (docs/spec/tariffs.md:69)
  { case: "classic, 50 min is 2 blocks", bike: "classic", returnAt: "2026-09-16T07:50:00Z", minutes: 50, total: 5000 },
  // 5 blocks × 40 UAH (docs/spec/tariffs.md:62, 67)
  { case: "e-bike, 130 min is 5 blocks", bike: "ebike", returnAt: "2026-09-16T09:10:00Z", minutes: 130, total: 20000 },
];

for (const { case: name, bike, returnAt, minutes, total } of itemised) {
  test(`T1, T3: quote returns an itemised price: ${name}`, () => {
    const result = quote(ride("2026-09-16T07:00:00Z", returnAt, { bike }), standard);
    assert.equal(result.minutes, minutes);
    assert.equal(result.total, total);
    // No subscription, concession or night ride, and the cap is not reached (docs/spec/tariffs.md:74-77, 86, 100, 141)
    assert.deepEqual(result.discounts, []);
    assert.deepEqual(result.fees, []);
  });
}

test("a ride of 30 min 20 s is billed as two blocks", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:20Z"), standard);
  assert.equal(result.minutes, 31);
  assert.equal(result.timeCharge, 5000);
});

test("e-bikes are billed at the e-bike rate", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:15:00Z", { bike: "ebike" }), standard);
  assert.equal(result.minutes, 75); // docs/spec/tariffs.md:45-47
  assert.equal(result.timeCharge, 12000); // 75 min → 3 blocks × 40 UAH, docs/spec/tariffs.md:70
  assert.equal(result.total, 12000); // a standard rider by day at S01: no discount, no fee
});

// One test per bike, so that a failing case does not hide the other (app/AGENTS.md, rule 5).
const subscriberRides = [
  // the first 45 minutes are free (docs/spec/tariffs.md:74, 81)
  { case: "classic, 40 min is free", bike: "classic", total: 0 },
  // no free minutes: 2 blocks × 40 UAH, 20 % off (docs/spec/tariffs.md:62, 67, 76-77)
  { case: "e-bike, 40 min is 8000 less 20 %", bike: "ebike", total: 6400 },
];

for (const { case: name, bike, total } of subscriberRides) {
  test(`T4: subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off: ${name}`, () => {
    const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { bike }), { type: "subscriber" });
    assert.equal(result.total, total);
  });
}

test("subscription on a long e-bike ride", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:40:00Z", { bike: "ebike" }), { type: "subscriber" });
  // 100 min → 4 blocks × 40 UAH = 160 UAH, 20 % off (docs/spec/tariffs.md:62, 67, 76)
  assert.equal(result.timeCharge, 16000);
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 3200 }]);
  assert.equal(result.total, 12800);
});

test("reduced fare for a ride returned outside the zone", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { returnStation: "X01" }), { type: "reduced" });
  assert.equal(result.total, 17500);
  assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]); // T7 fee in full, no reduced fare on it: docs/spec/tariffs.md:87, 112
});

test("night rides get 30 % off", () => {
  // 01:10–01:40 in Kyiv
  const result = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:40:00Z"), standard);
  assert.equal(result.timeCharge, 2500);
  assert.equal(result.discounts.length, 1);
  assert.equal(result.discounts[0].code, "night");
  assert.equal(result.discounts[0].amount, 750); // 30 % of 2500, docs/spec/tariffs.md:141
  assert.equal(result.total, 1750); // docs/spec/tariffs.md:143
});

test("a bike kept over a day and left outside the zone pays both fees", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  // Both fees apply, in no fixed order (docs/spec/tariffs.md:121-122, 133-135): sorted by code, then compared.
  const byCode = (a, b) => a.code.localeCompare(b.code);
  assert.deepEqual(result.fees.toSorted(byCode), [
    { code: "out-of-zone", amount: 15000 },
    { code: "unreturned", amount: 200000 },
  ]);
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
  // 80 min on an e-bike is 120 UAH; two rides leave 60 UAH of the cap for the third (docs/spec/tariffs.md:105-106)
  assert.equal(last.total, 6000);
  assert.deepEqual(last.discounts, [{ code: "day-cap", amount: 6000 }]);
  assert.equal(dayCap.chargedOn("rider-7", "2026-09-16"), 30000); // docs/spec/tariffs.md:105-106
});

test("a 45-minute classic ride costs 50 UAH", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:45:00Z"), standard);
  assert.equal(result.total, 5000); // 45 min → 2 blocks × 25 UAH, docs/spec/tariffs.md:62, 66
});

test("a return before the pickup is rejected", () => {
  assert.throws(() => quote(ride("2026-09-16T08:00:00Z", "2026-09-16T07:00:00Z"), standard), QuoteError);
});

test("a missing ride is rejected with a QuoteError", () => {
  for (const missing of [null, undefined]) {
    assert.throws(() => quote(missing, standard), QuoteError);
  }
});
