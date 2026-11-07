import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { QuoteError, quote } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, extra = {}) => ({ pickupAt, returnAt, bike: "classic", returnStation: "S01", ...extra });
const standard = { type: "standard" };

// 07:00Z = 10:00 Kyiv (September, UTC+03:00) — a day ride, outside the T10 night window.
test("quote returns an itemised price", () => {
  const cases = [
    // T2 (docs/spec/tariffs.md:54): 1 min → no time charge.
    [ride("2026-09-16T07:00:00Z", "2026-09-16T07:01:00Z"), { minutes: 1, timeCharge: 0, discounts: [], fees: [], total: 0 }],
    // T3 (:62-69): classic, 50 min → 2 blocks → 5 000.
    [ride("2026-09-16T07:00:00Z", "2026-09-16T07:50:00Z"), { minutes: 50, timeCharge: 5000, discounts: [], fees: [], total: 5000 }],
    // T3: e-bike, 130 min → 5 blocks × 4 000 → 20 000.
    [
      ride("2026-09-16T07:00:00Z", "2026-09-16T09:10:00Z", { bike: "ebike" }),
      { minutes: 130, timeCharge: 20000, discounts: [], fees: [], total: 20000 },
    ],
  ];
  for (const [r, expected] of cases) {
    assert.deepEqual(quote(r, standard), expected);
  }
});

// T1 (docs/spec/tariffs.md:46-47): a partial minute counts as a full one → 31 min → 2 blocks (:62).
test("a ride of 30 min 20 s is billed as two blocks", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:20Z"), standard);
  assert.equal(result.minutes, 31);
  assert.equal(result.timeCharge, 5000);
});

// T3 (:70): e-bike, 75 min → 3 blocks × 4 000 → 12 000.
test("e-bikes are billed at the e-bike rate", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:15:00Z", { bike: "ebike" }), standard);
  assert.equal(result.minutes, 75);
  assert.equal(result.timeCharge, 12000);
  assert.equal(result.total, 12000);
});

// T4 (docs/spec/tariffs.md:74-77): 45 free minutes on a classic bike only; an e-bike gets 20 % off
// instead — 40 min → 2 blocks × 4 000 = 8 000 − 20 % → 6 400.
test("subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off", () => {
  const expected = { classic: 0, ebike: 6400 };
  for (const bike of ["classic", "ebike"]) {
    const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { bike }), { type: "subscriber" });
    assert.equal(result.total, expected[bike], bike);
  }
});

// T4 (:76-77): e-bike, 100 min → 4 blocks × 4 000 = 16 000 − 20 % (3 200) → 12 800.
test("subscription on a long e-bike ride", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:40:00Z", { bike: "ebike" }), { type: "subscriber" });
  assert.equal(result.timeCharge, 16000);
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 3200 }]);
  assert.equal(result.total, 12800);
});

// T5 (docs/spec/tariffs.md:86-87): 50 % off the time charge only, not the fee — 5 000 − 50 % = 2 500,
// plus the full T7 fee 15 000 (:112) → 17 500.
test("reduced fare for a ride returned outside the zone", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { returnStation: "X01" }), { type: "reduced" });
  assert.deepEqual(result.discounts, [{ code: "reduced", amount: 2500 }]);
  assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
  assert.equal(result.total, 17500);
});

// T10 (:141-143): 01:10–01:40 Kyiv → 2 500 − 30 % (750) → 1 750.
test("night rides get 30 % off", () => {
  const result = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:40:00Z"), standard);
  assert.equal(result.timeCharge, 2500);
  assert.deepEqual(result.discounts, [{ code: "night", amount: 750 }]);
  assert.equal(result.total, 1750);
});

// T7 + T8 (:111-122): 48 h → 96 blocks = 240 000 → capped at 30 000 (T6) + 15 000 + 200 000 → 245 000.
test("a bike kept over a day and left outside the zone pays both fees", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  assert.deepEqual(result.fees, [
    { code: "out-of-zone", amount: 15000 },
    { code: "unreturned", amount: 200000 },
  ]);
  assert.equal(result.total, 245000);
});

// T6 (:105-106): three 80-min e-bike rides on 16.09 (09:00, 13:00, 18:00 Kyiv) → 12 000; 12 000; 6 000.
test("the daily cap limits the time charge", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-7", type: "standard" };
  const results = [["06:00", "07:20"], ["10:00", "11:20"], ["15:00", "16:20"]].map(([from, to]) =>
    quote(ride(`2026-09-16T${from}:00Z`, `2026-09-16T${to}:00Z`, { bike: "ebike" }), rider, { dayCap }),
  );
  assert.deepEqual(results.map((r) => r.total), [12000, 12000, 6000]);
  assert.deepEqual(results[2].discounts, [{ code: "day-cap", amount: 6000 }]);
  assert.equal(dayCap.chargedOn("rider-7", "2026-09-16"), 30000);
});

// T3 (:62): classic, 45 min → 2 blocks → 5 000.
test("a 45-minute classic ride costs 50 UAH", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:45:00Z"), standard);
  assert.equal(result.total, 5000);
});

test("a return before the pickup is rejected", () => {
  assert.throws(() => quote(ride("2026-09-16T08:00:00Z", "2026-09-16T07:00:00Z"), standard), QuoteError);
});

// ---- the itemised list: a discount line appears only when it takes something off ----

// T2 + T10: a false start at night has nothing to discount → no "night" line with 0.
test("a false start at night has no night discount line", () => {
  const result = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:11:00Z"), standard);
  assert.deepEqual(result, { minutes: 1, timeCharge: 0, discounts: [], fees: [], total: 0 });
});

// T4 + T10: subscriber, classic, 40 min at night → the subscription takes all 5 000, the night discount nothing.
test("a free subscriber ride at night has only the subscription line", () => {
  const result = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:50:00Z"), { type: "subscriber" });
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 5000 }]);
  assert.equal(result.total, 0);
});

// T6 (:100-101): exactly 30 000 does not exceed the cap → no "day-cap" line.
test("a time charge exactly at the daily cap has no day-cap line", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T13:00:00Z"), { id: "U1", type: "standard" }, { dayCap: createDayCap() });
  assert.equal(result.timeCharge, 30000);
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 30000);
});

// T6: with the cap used up, a false start (0 due) gets no "day-cap" line of 0.
test("a free ride after the cap is used up has no day-cap line", () => {
  const dayCap = createDayCap();
  const rider = { id: "U1", type: "standard" };
  quote(ride("2026-09-16T07:00:00Z", "2026-09-16T13:00:00Z"), rider, { dayCap });
  const result = quote(ride("2026-09-16T14:00:00Z", "2026-09-16T14:01:00Z"), rider, { dayCap });
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 0);
});

// T6 + T9 (:133-135): the cap line is the amount above the cap — e-bike, 480 min = 64 000 → −34 000 → 30 000.
for (const [label, options] of [
  ["with a ledger", () => ({ dayCap: createDayCap() })],
  ["without a ledger", () => ({})],
]) {
  test(`the day-cap line is the part of the charge above the cap (${label})`, () => {
    const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T15:00:00Z", { bike: "ebike" }), { id: "U1", type: "standard" }, options());
    assert.equal(result.timeCharge, 64000);
    assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 34000 }]);
    assert.equal(result.total, 30000);
  });
}

// T6: a ride is booked into the ledger after the discounts, so the next ride sees what is left.
test("the ledger books what the rider actually paid for time", () => {
  const dayCap = createDayCap();
  const rider = { id: "U1", type: "reduced" };
  quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { returnStation: "X01" }), rider, { dayCap });
  // 5 000 − 50 % = 2 500 of time charge; the T7 fee is not booked (:102-103).
  assert.equal(dayCap.chargedOn("U1", "2026-09-16"), 2500);
  assert.equal(dayCap.remaining("U1", "2026-09-16T12:00:00Z"), 27500);
});

// ---- §4: invalid input ----
// §4 (docs/spec/tariffs.md:147-149) requires only that the request is rejected *with an
// explanation*; the wording of the explanation is not specified, so tests do not pin it.
const rejectedWithExplanation = (err) =>
  err instanceof QuoteError && typeof err.message === "string" && err.message.trim().length > 0;

test("a missing ride is rejected with an explanation", () => {
  assert.throws(() => quote(null, standard), rejectedWithExplanation);
  assert.throws(() => quote(undefined, standard), rejectedWithExplanation);
  assert.throws(() => quote("2026-09-16T07:00:00Z", standard), rejectedWithExplanation);
});

// API contract (AGENTS.md: ISO 8601 with Z or an offset), not a rule of the specification.
test("an instant without an offset is rejected", () => {
  assert.throws(() => quote(ride("2026-09-16T10:00:00", "2026-09-16T10:30:00Z"), standard), rejectedWithExplanation);
  assert.throws(() => quote(ride("2026-09-16T10:00:00Z", "2026-09-16T10:30:00"), standard), rejectedWithExplanation);
});

test("a non-string instant is rejected", () => {
  assert.throws(() => quote(ride(Date.UTC(2026, 8, 16, 7), "2026-09-16T07:30:00Z"), standard), rejectedWithExplanation);
});

test("an impossible date is rejected", () => {
  assert.throws(() => quote(ride("2026-09-16T07:00:00Z", "2026-13-45T07:30:00Z"), standard), rejectedWithExplanation);
});

test("a daily cap ledger requires a rider id", () => {
  assert.throws(
    () => quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z"), standard, { dayCap: createDayCap() }),
    rejectedWithExplanation,
  );
});
