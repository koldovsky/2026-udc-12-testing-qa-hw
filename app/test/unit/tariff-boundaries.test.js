// Boundary and exact-value tests that pin down the edges of quote().
import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { QuoteError, quote } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, extra = {}) => ({ pickupAt, returnAt, bike: "classic", returnStation: "S01", ...extra });
const standard = { type: "standard" };

// T2 (docs/spec/tariffs.md:54) + T10 (:141): a false start has no time charge, so there is nothing to discount.
test("T2: a free ride at night has no discounts at all (nothing to discount)", () => {
  // 03:00 Kyiv, 2 minutes: T2 makes it free, so the night discount must not appear
  const result = quote(ride("2026-09-16T03:00:00+03:00", "2026-09-16T03:02:00+03:00"), standard);
  assert.equal(result.timeCharge, 0);
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 0);
});

// T6 (docs/spec/tariffs.md:100-101): «не перевищує» — a charge equal to what is left is not cut.
test("T6: a time charge equal to the remaining cap is not reduced", () => {
  const dayCap = createDayCap({ limit: 2500 });
  const result = quote(ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:05:00+03:00"), { ...standard, id: "r1" }, { dayCap });
  assert.equal(result.timeCharge, 2500);
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 2500);
});

// T6 (docs/spec/tariffs.md:100-101) + T9 (:133-135): 13 h = 26 blocks = 65000 (T3 :62-66) → 30000; the cut is a minus line.
test("T6: a time charge over the cap is cut to the cap, the cut is a positive day-cap discount", () => {
  const result = quote(ride("2026-09-16T10:00:00+03:00", "2026-09-16T23:00:00+03:00"), standard);
  assert.equal(result.timeCharge, 65000);
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 35000 }]);
  assert.equal(result.total, 30000);
});

// T6 (docs/spec/tariffs.md:100-101): the cap is for the sum of a day's charges, so the cut is against what is left.
test("T6: the cap cut is measured against what the ledger has left", () => {
  const dayCap = createDayCap({ limit: 5000 });
  const rider = { ...standard, id: "r1" };
  quote(ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:05:00+03:00"), rider, { dayCap }); // 2500
  const result = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T13:30:00+03:00"), rider, { dayCap }); // 7500
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 5000 }]);
  assert.equal(result.total, 2500);
  assert.equal(dayCap.chargedOn("r1", "2026-09-16"), 5000);
});

// §4 (docs/spec/tariffs.md:147-149): incomplete input is rejected with an explanation, not priced.
test("T1: quote(null) is rejected with a QuoteError", () => {
  assert.throws(() => quote(null, standard), QuoteError);
  assert.throws(() => quote(undefined, standard), QuoteError);
});

// §4 (docs/spec/tariffs.md:147-148) rejects only a return EARLIER than the pickup; 0 min ≤ 2 min → T2 (:54).
test("T1: a ride returned at the very instant of pickup is valid and free", () => {
  const result = quote(ride("2026-09-16T10:00:00Z", "2026-09-16T10:00:00Z"), standard);
  assert.equal(result.minutes, 0);
  assert.equal(result.total, 0);
});

// §4 (docs/spec/tariffs.md:147-148): a return earlier than the pickup is rejected.
test("T1: a ride returned one second before pickup is rejected", () => {
  assert.throws(() => quote(ride("2026-09-16T10:00:01Z", "2026-09-16T10:00:00Z"), standard), /before/);
});

// Not a spec rule: the API contract (app/src/tariff.js:5, AGENTS.md «Instants … with Z or an offset»). Times are Kyiv
// time (docs/spec/tariffs.md:37-38), so an instant without an offset is ambiguous and is rejected.
test("T1: a date-time without an offset is rejected by the format check", () => {
  assert.throws(
    () => quote(ride("2026-09-16T10:00:00", "2026-09-16T11:00:00Z"), standard),
    (e) => e instanceof QuoteError && /ISO 8601/.test(e.message),
  );
  assert.throws(
    () => quote(ride("2026-09-16T10:00:00Z", "2026-09-16"), standard),
    (e) => e instanceof QuoteError && /ISO 8601/.test(e.message),
  );
});
