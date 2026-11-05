// Boundary and exact-value tests that pin down the edges of quote().
import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { QuoteError, quote } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, extra = {}) => ({ pickupAt, returnAt, bike: "classic", returnStation: "S01", ...extra });
const standard = { type: "standard" };

test("a free ride at night has no discounts at all (nothing to discount)", () => {
  // 03:00 Kyiv, 2 minutes: T2 makes it free, so the night discount must not appear
  const result = quote(ride("2026-09-16T03:00:00+03:00", "2026-09-16T03:02:00+03:00"), standard);
  assert.equal(result.timeCharge, 0);
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 0);
});

test("a time charge equal to the remaining cap is not reduced", () => {
  const dayCap = createDayCap({ limit: 2500 });
  const result = quote(ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:05:00+03:00"), { ...standard, id: "r1" }, { dayCap });
  assert.equal(result.timeCharge, 2500);
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 2500);
});

test("a time charge over the cap is cut to the cap, the cut is a positive day-cap discount", () => {
  const result = quote(ride("2026-09-16T10:00:00+03:00", "2026-09-16T23:00:00+03:00"), standard);
  assert.equal(result.timeCharge, 65000);
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 35000 }]);
  assert.equal(result.total, 30000);
});

test("the cap cut is measured against what the ledger has left", () => {
  const dayCap = createDayCap({ limit: 5000 });
  const rider = { ...standard, id: "r1" };
  quote(ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:05:00+03:00"), rider, { dayCap }); // 2500
  const result = quote(ride("2026-09-16T12:00:00+03:00", "2026-09-16T13:30:00+03:00"), rider, { dayCap }); // 7500
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 5000 }]);
  assert.equal(result.total, 2500);
  assert.equal(dayCap.chargedOn("r1", "2026-09-16"), 5000);
});

test("quote(null) is rejected with a QuoteError", () => {
  assert.throws(() => quote(null, standard), QuoteError);
  assert.throws(() => quote(undefined, standard), QuoteError);
});

test("a ride returned at the very instant of pickup is valid and free", () => {
  const result = quote(ride("2026-09-16T10:00:00Z", "2026-09-16T10:00:00Z"), standard);
  assert.equal(result.minutes, 0);
  assert.equal(result.total, 0);
});

test("a ride returned one second before pickup is rejected", () => {
  assert.throws(() => quote(ride("2026-09-16T10:00:01Z", "2026-09-16T10:00:00Z"), standard), /before/);
});

test("a date-time without an offset is rejected by the format check", () => {
  assert.throws(
    () => quote(ride("2026-09-16T10:00:00", "2026-09-16T11:00:00Z"), standard),
    (e) => e instanceof QuoteError && /ISO 8601/.test(e.message),
  );
  assert.throws(
    () => quote(ride("2026-09-16T10:00:00Z", "2026-09-16"), standard),
    (e) => e instanceof QuoteError && /ISO 8601/.test(e.message),
  );
});
