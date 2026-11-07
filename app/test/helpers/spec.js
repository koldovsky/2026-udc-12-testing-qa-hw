// Helpers for the specification tests (app/test/spec/*.test.js).
// Expected values live in the test tables only — they come from docs/test-cases.md and
// docs/spec/tariffs.md. This file knows how to call quote() and read its result, nothing more.
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { QuoteError, quote } from "../../src/tariff.js";

export const STANDARD = Object.freeze({ type: "standard" });
export const REDUCED = Object.freeze({ type: "reduced" });
export const SUBSCRIBER = Object.freeze({ type: "subscriber" });
export const SUBSCRIBER_CONCESSION = Object.freeze({ type: "subscriber", concession: true });

export function ride(pickupAt, returnAt, { bike = "classic", station = "S01" } = {}) {
  return { pickupAt, returnAt, bike, returnStation: station };
}

/**
 * Prices a ride against a daily cap ledger. A fresh ledger means "the rider has no time
 * charges yet on the ride's day" (the default assumption of docs/test-cases.md).
 */
export function price(r, rider = STANDARD, { ledger = createDayCap(), id = "U1" } = {}) {
  return quote(r, { ...rider, id }, { dayCap: ledger });
}

/** A ledger in which the given time charges are already booked: [{ id, pickupAt, amount }]. */
export function ledgerWith(charges = []) {
  const ledger = createDayCap();
  for (const { id, pickupAt, amount } of charges) ledger.record(id, pickupAt, amount);
  return ledger;
}

export const feesTotal = (q) => q.fees.reduce((sum, fee) => sum + fee.amount, 0);
const discountAmount = (q, code) => q.discounts.filter((d) => d.code === code).reduce((s, d) => s + d.amount, 0);
const hasDiscount = (q, code) => q.discounts.some((d) => d.code === code);

/**
 * Checks only the fields the test case states:
 *   minutes    — duration by T1
 *   timeCharge — the T3 price before discounts
 *   hourly     — time charge after discounts and the cap (total minus fees)
 *   fees       — sum of all fees (T7, T8)
 *   feeAmounts — the separate fee amounts, ascending (T7, T8 are separate items: spec :121-122, :134-135)
 *   discounts  — { code: amount }; 0 means "no such discount"
 *   plan       — "reduced" | "subscription": which of T4 / T5 was applied
 *   total      — amount due
 */
export function assertQuote(q, expected) {
  if ("minutes" in expected) assert.equal(q.minutes, expected.minutes, "тривалість, хв (T1)");
  if ("timeCharge" in expected) assert.equal(q.timeCharge, expected.timeCharge, "погодинне за T3, коп.");
  for (const [code, amount] of Object.entries(expected.discounts ?? {})) {
    if (amount === 0) assert.ok(!hasDiscount(q, code), `знижки «${code}» не має бути: ${JSON.stringify(q.discounts)}`);
    else assert.equal(discountAmount(q, code), amount, `знижка «${code}», коп.`);
  }
  if (expected.plan === "reduced") {
    assert.ok(hasDiscount(q, "reduced"), `має бути застосована пільга: ${JSON.stringify(q.discounts)}`);
    assert.ok(!hasDiscount(q, "subscription"), `абонемент не має застосовуватись: ${JSON.stringify(q.discounts)}`);
  }
  if (expected.plan === "subscription") {
    assert.ok(!hasDiscount(q, "reduced"), `пільга не має застосовуватись: ${JSON.stringify(q.discounts)}`);
  }
  if ("hourly" in expected) assert.equal(q.total - feesTotal(q), expected.hourly, "погодинне після знижок і ліміту, коп.");
  if ("fees" in expected) assert.equal(feesTotal(q), expected.fees, "збори, коп.");
  if ("feeAmounts" in expected) assert.deepEqual(q.fees.map((f) => f.amount).sort((a, b) => a - b), expected.feeAmounts, "окремі збори, коп. (T7, T8)");
  if ("total" in expected) assert.equal(q.total, expected.total, "до сплати, коп.");
}

/** "Rejected with an explanation, no calculation" (§4): a QuoteError with a non-empty message — the server answers it with 400 and that message (src/server.js:38-39); any other error is a 500 with no explanation. The wording is not specified (Q-11). */
export function assertRejected(fn) {
  assert.throws(fn, (err) => err instanceof QuoteError && err.message.trim().length > 0);
}
