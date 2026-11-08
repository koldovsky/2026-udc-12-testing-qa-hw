import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP } from "../../src/day-cap.js";
import { QuoteError, quote } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, extra = {}) => ({ pickupAt, returnAt, bike: "classic", returnStation: "S01", ...extra });
const standard = { type: "standard" };

test("quote returns an itemised price", () => {
  // all pickups 10:00 Kyiv; expected totals from the spec:
  // 1 min → T2, 0 (docs/spec/tariffs.md:54); 50 min classic → 2 blocks, 5000 (:62, :66, :69);
  // 130 min e-bike → 5 blocks × 4000 = 20000 (:62, :67)
  const rides = [
    [ride("2026-09-16T07:00:00Z", "2026-09-16T07:01:00Z"), 0],
    [ride("2026-09-16T07:00:00Z", "2026-09-16T07:50:00Z"), 5000],
    [ride("2026-09-16T07:00:00Z", "2026-09-16T09:10:00Z", { bike: "ebike" }), 20000],
  ];
  for (const [r, expected] of rides) {
    const result = quote(r, standard);
    assert.equal(result.total, expected);
    assert.ok(result.total >= 0);
    assert.ok(Array.isArray(result.discounts));
    assert.ok(Array.isArray(result.fees));
    assert.equal(typeof result.minutes, "number");
  }
});

test("a ride of 30 min 20 s is billed as two blocks", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:20Z"), standard);
  // T1, docs/spec/tariffs.md:45-47 — partial minute rounds up: 31 min → 2 blocks
  assert.equal(result.minutes, 31);
  assert.equal(result.timeCharge, 5000);
});

test("e-bikes are billed at the e-bike rate", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:15:00Z", { bike: "ebike" }), standard);
  // T3, docs/spec/tariffs.md:70 — e-bike, 75 min → 3 blocks × 4000 = 12000
  assert.equal(result.minutes, 75);
  assert.equal(result.timeCharge, 12000);
  assert.equal(result.total, result.timeCharge);
});

test("subscribers ride the first 45 minutes free on a classic bike only", () => {
  for (const bike of ["classic", "ebike"]) {
    const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { bike }), { type: "subscriber" });
    // T4, docs/spec/tariffs.md:74-77 — no free minutes on an e-bike: 40 min = 2 blocks 8000 − 20 % = 6400
    assert.equal(result.total, bike === "classic" ? 0 : 6400);
  }
});

test("subscription on a long e-bike ride", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:40:00Z", { bike: "ebike" }), { type: "subscriber" });
  assert.ok(result.discounts.some((d) => d.code === "subscription"));
  assert.ok(result.total < result.timeCharge);
  // T3/T4, docs/spec/tariffs.md:67, :76-77 — 100 min e-bike → 4 blocks = 16000; −20 % = 3200
  assert.equal(result.timeCharge, 16000);
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 3200 }]);
  assert.equal(result.total, 12800);
});

test("reduced fare for a ride returned outside the zone", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { returnStation: "X01" }), { type: "reduced" });
  // T5, docs/spec/tariffs.md:86-87 — reduced fare does not apply to fees: 5000 − 50 % = 2500 + 15000
  assert.equal(result.total, 17500);
  assert.equal(result.fees[0].amount, 15000);
});

test("night rides get 30 % off", () => {
  // 01:10–01:40 in Kyiv
  const result = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:40:00Z"), standard);
  // T3, docs/spec/tariffs.md:62, :66 — 30 min classic = 1 block = 2500
  assert.equal(result.timeCharge, 2500);
  assert.equal(result.discounts.length, 1);
  assert.equal(result.discounts[0].code, "night");
  assert.ok(result.total < result.timeCharge);
  // T10, docs/spec/tariffs.md:141, :143 — 30 % of 2500 = 750; total 1750
  assert.deepEqual(result.discounts, [{ code: "night", amount: 750 }]);
  assert.equal(result.total, 1750);
});

test("a bike kept over a day and left outside the zone pays both fees", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  assert.equal(result.fees.length, 2);
  // T7 150 UAH, T8 2000 UAH — docs/spec/tariffs.md:111-112, :119-122
  // `total` is deliberately not asserted: for a 48-hour ride it depends on open question Q-13 (multi-day cap, docs/test-plan.md)
  assert.deepEqual(result.fees.map((f) => f.amount).sort((a, b) => a - b), [15000, 200000]);
});

test("the daily cap limits the time charge", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-7", type: "standard" };
  let last;
  const totals = [];
  for (const [from, to] of [["06:00", "07:20"], ["10:00", "11:20"], ["15:00", "16:20"]]) {
    last = quote(ride(`2026-09-16T${from}:00Z`, `2026-09-16T${to}:00Z`, { bike: "ebike" }), rider, { dayCap });
    totals.push(last.total);
  }
  assert.ok(last.total <= DAY_CAP);
  // T6, docs/spec/tariffs.md:105-106 — three 80-min e-bike rides (09:00, 13:00, 18:00 Kyiv): 120 + 120 + 60 UAH
  assert.deepEqual(totals, [12000, 12000, 6000]);
});

test("a 45-minute classic ride costs 50 UAH", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:45:00Z"), standard);
  // T3, docs/spec/tariffs.md:62, :66 — 45 min = 2 blocks × 2500
  assert.equal(result.minutes, 45);
  assert.equal(result.total, 5000);
});

test("a return before the pickup is rejected", () => {
  assert.throws(() => quote(ride("2026-09-16T08:00:00Z", "2026-09-16T07:00:00Z"), standard), QuoteError);
});

// --- Strengthened after the mutation run (Task C) ---

test("a ride that starts at 06:30 in Kyiv gets no night discount (T10: 00:00–06:00)", () => {
  // 06:30–06:50 Kyiv lies wholly outside the night window
  const result = quote(ride("2026-09-17T06:30:00+03:00", "2026-09-17T06:50:00+03:00"), standard);
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 2500);
});

test("a subscriber's 31-minute e-bike ride is billed from the first minute: 2 blocks − 20 %", () => {
  // T4: no free minutes on an e-bike — 31 min = 2 blocks = 8000 − 20 % = 6400
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:31:00Z", { bike: "ebike" }), { type: "subscriber" });
  assert.equal(result.timeCharge, 8000);
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 1600 }]);
  assert.equal(result.total, 6400);
});

test("a null ride is rejected with a QuoteError, not a TypeError", () => {
  assert.throws(() => quote(null, standard), QuoteError);
  assert.throws(() => quote(undefined, standard), QuoteError);
});

test("a pickupAt that is not a string is rejected even if it stringifies to a valid date", () => {
  // e.g. a JSON body with ["2026-09-16T07:00:00Z"] — String([x]) === x
  const asArray = { ...ride("2026-09-16T07:00:00Z", "2026-09-16T07:20:00Z"), pickupAt: ["2026-09-16T07:00:00Z"] };
  assert.throws(() => quote(asArray, standard), QuoteError);
  const asObject = { ...ride("2026-09-16T07:00:00Z", "2026-09-16T07:20:00Z"), returnAt: { toString: () => "2026-09-16T07:20:00Z" } };
  assert.throws(() => quote(asObject, standard), QuoteError);
});
