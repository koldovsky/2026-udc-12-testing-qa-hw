import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP } from "../../src/day-cap.js";
import { QuoteError, quote } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, extra = {}) => ({ pickupAt, returnAt, bike: "classic", returnStation: "S01", ...extra });
const standard = { type: "standard" };
// Kyiv summer time is UTC+3, so these are explicit Kyiv wall-clock instants.
const kyiv = (time, day = 16) => `2026-09-${day}T${time}+03:00`;

// T10 (tariffs.md:141): 06:30 is outside 00:00–06:00 under any reading. The agent's tests for a
// ride crossing 06:00 (Q-1) and for the exact 06:00:00 (Q-2) were removed: the spec leaves both open.
test("a pickup at 06:30 does not get the night discount", () => {
  const result = quote(ride(kyiv("06:30:00"), kyiv("07:00:00")), standard);
  assert.deepEqual(result.discounts, []);
});

test("a free night ride lists no discounts", () => {
  const result = quote(ride(kyiv("01:00:00"), kyiv("01:02:00")), standard);
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 0);
});

test("a standard rider has no fare discount entry", () => {
  const result = quote(ride(kyiv("12:00:00"), kyiv("12:30:00")), standard);
  assert.deepEqual(result.discounts, []);
});

// T5: equal sums -> the subscription applies.
test("on equal sums the subscription wins over the reduced fare", () => {
  const result = quote(ride(kyiv("12:00:00"), kyiv("13:00:00")), { type: "subscriber", concession: true });
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
  assert.equal(result.total, 2500);
});

// T6: a charge exactly equal to what is left of the cap is not capped.
test("a charge equal to the remaining cap adds no day-cap discount", () => {
  const dayCap = createDayCap();
  dayCap.record("u1", kyiv("08:00:00"), DAY_CAP - 2500);
  const result = quote(ride(kyiv("12:00:00"), kyiv("12:30:00")), { ...standard, id: "u1" }, { dayCap });
  assert.deepEqual(result.discounts, []);
  assert.equal(result.total, 2500);
  assert.equal(dayCap.remaining("u1", kyiv("12:00:00")), 0);
});

test("a charge above the remaining cap is cut to it", () => {
  const dayCap = createDayCap();
  dayCap.record("u1", kyiv("08:00:00"), DAY_CAP - 2500);
  const result = quote(ride(kyiv("12:00:00"), kyiv("13:00:00")), { ...standard, id: "u1" }, { dayCap });
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 2500 }]);
  assert.equal(result.total, 2500);
});

// Input validation.
test("a missing ride is a QuoteError", () => {
  assert.throws(() => quote(null, standard), QuoteError);
  assert.throws(() => quote(undefined, standard), QuoteError);
});

test("a date without time or offset is a QuoteError", () => {
  assert.throws(() => quote(ride("2026-09-16", "2026-09-16T08:00:00Z"), standard), QuoteError);
  assert.throws(() => quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:00:00"), standard), QuoteError);
});

test("a non-string instant is a QuoteError even if it prints as a date-time", () => {
  const lookalike = { toString: () => "2026-09-16T07:00:00Z" };
  assert.throws(() => quote(ride(lookalike, "2026-09-16T08:00:00Z"), standard), QuoteError);
});
