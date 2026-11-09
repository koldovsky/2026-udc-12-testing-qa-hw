// Shared by test/spec/: the defaults of docs/test-cases.md («Conventions») and the terms its
// expected results use. Expected values live in the tables of test/spec/*.test.js.
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { QuoteError, quote } from "../../src/tariff.js";

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

const PICKUP = "2026-09-16T07:00:00Z"; // 10:00 in Kyiv

export const standard = { id: "R1", type: "standard" };
export const concession = { id: "R1", type: "reduced" };
export const subscriber = { id: "R1", type: "subscriber" };
export const subscriberWithConcession = { id: "R1", type: "subscriber", concession: true };

/** `after` is the time from pickup to return in ms; an explicit `returnAt` wins over it. */
export function ride({ pickupAt = PICKUP, after = 0, returnAt, bike = "classic", returnStation = "S03" } = {}) {
  return {
    pickupAt,
    returnAt: returnAt ?? new Date(Date.parse(pickupAt) + after).toISOString(),
    bike,
    returnStation,
  };
}

/**
 * quote() in the terms of docs/test-cases.md: `time` is `total` minus `fees`, `t3` is the T3
 * price before discounts. Every ride goes through a daily cap ledger.
 */
export function price(rideSpec, rider = standard, dayCap = createDayCap()) {
  return inTestCaseTerms(quote(ride(rideSpec), rider, { dayCap }));
}

function inTestCaseTerms(result) {
  const fees = result.fees.reduce((sum, fee) => sum + fee.amount, 0);
  const cap = result.discounts.find((item) => item.code === "day-cap");
  return {
    minutes: result.minutes,
    t3: result.timeCharge,
    time: result.total - fees,
    fees,
    total: result.total,
    capReduction: cap?.amount ?? 0,
    concessionApplied: result.discounts.some((item) => item.code === "reduced"),
  };
}

/** Compares only the fields the test case states. */
export function assertPrice(actual, expected) {
  const stated = Object.fromEntries(Object.keys(expected).map((key) => [key, actual[key]]));
  assert.deepEqual(stated, expected);
}

/** §4: no price, and an explanation. The spec fixes no wording, so only its presence is checked. */
export function assertRejected(rideSpec, rider = standard) {
  assert.throws(
    () => quote(ride(rideSpec), rider, { dayCap: createDayCap() }),
    (error) => error instanceof QuoteError && error.message.length > 0,
  );
}

/** A ledger after the given rides of R1; fails if they did not add up to `dayTotal`. */
export function ledgerAfter(rides, dayTotal) {
  const dayCap = createDayCap();
  const charged = rides.reduce((sum, item) => sum + price(item, standard, dayCap).time, 0);
  assert.equal(charged, dayTotal, "setup: time charges of the earlier rides");
  return dayCap;
}

export const ebike80 = (pickupAt) => ({ pickupAt, after: 80 * MINUTE, bike: "ebike" });

export const TC45_RIDES = [
  ebike80("2026-09-16T06:00:00Z"),
  ebike80("2026-09-16T10:00:00Z"),
  ebike80("2026-09-16T15:00:00Z"),
];

/** "At cap": R1 already has 30000 in time charges on 16.09, the three rides of TC-45. */
export const atCap = () => ledgerAfter(TC45_RIDES, 30000);
