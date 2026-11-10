import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCK_MINUTES,
  FREE_START_MINUTES,
  OUT_OF_ZONE_FEE,
  RATES,
  REDUCED_PERCENT,
  SUBSCRIPTION_FREE_MINUTES,
  UNRETURNED_FEE,
  discount,
  quote,
  QuoteError,
} from "../../app/src/tariff.js";

const zones = {
  zoneOf(station) {
    return { inside: "in", outside: "out" }[station] ?? null;
  },
};

const ride = (minutes, overrides = {}) => ({
  pickupAt: "2026-01-15T10:00:00Z",
  returnAt: new Date(Date.parse("2026-01-15T10:00:00Z") + minutes * 60_000).toISOString(),
  bike: "classic",
  returnStation: "inside",
  ...overrides,
});

test("discount rounds the amount left down to kopecks", () => {
  assert.equal(discount(101, 50), 51);
  assert.equal(discount(2500, REDUCED_PERCENT), 1250);
});

test("charges no time fee below two minutes and one block at the boundary", () => {
  assert.equal(quote(ride(FREE_START_MINUTES - 1), { type: "standard" }, { zones }).total, 0);
  assert.deepEqual(quote(ride(FREE_START_MINUTES), { type: "standard" }, { zones }), {
    minutes: FREE_START_MINUTES,
    timeCharge: RATES.classic,
    discounts: [],
    fees: [],
    total: RATES.classic,
  });
});

test("rounds a ride up to the next thirty-minute block", () => {
  const result = quote(ride(BLOCK_MINUTES + 1), { type: "standard" }, { zones });
  assert.equal(result.minutes, BLOCK_MINUTES + 1);
  assert.equal(result.timeCharge, RATES.classic * 2);
  assert.equal(result.total, RATES.classic * 2);
});

test("uses the ebike rate", () => {
  assert.equal(quote(ride(2, { bike: "ebike" }), { type: "standard" }, { zones }).total, RATES.ebike);
});

test("applies reduced fare to time charge and out-of-zone fee", () => {
  const result = quote(ride(2, { returnStation: "outside" }), { type: "reduced" }, { zones });
  assert.deepEqual(result.discounts, [{ code: "reduced", amount: 1250 }]);
  assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
  assert.equal(result.total, 8750);
});

test("subscriber gets 45 free minutes and charges the next block", () => {
  const free = quote(ride(SUBSCRIPTION_FREE_MINUTES), { type: "subscriber" }, { zones });
  const billed = quote(ride(SUBSCRIPTION_FREE_MINUTES + 1), { type: "subscriber" }, { zones });
  assert.equal(free.total, 0);
  assert.deepEqual(billed.discounts, [{ code: "subscription", amount: 2500 }]);
  assert.equal(billed.total, 2500);
});

test("subscriber ebike subscription reduces its billed block by twenty percent", () => {
  const result = quote(ride(SUBSCRIPTION_FREE_MINUTES + 1, { bike: "ebike" }), { type: "subscriber" }, { zones });
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 3200 }]);
  assert.equal(result.total, 800);
});

test("subscriber concession chooses the cheaper reduced plan when applicable", () => {
  const result = quote(ride(60), { type: "subscriber", concession: true }, { zones });
  assert.deepEqual(result.discounts, [{ code: "reduced", amount: 2500 }]);
  assert.equal(result.total, 2500);
});

test("applies night discount only before six Kyiv time", () => {
  const night = quote(ride(2, { pickupAt: "2026-01-15T02:00:00Z", returnAt: "2026-01-15T02:02:00Z" }), { type: "standard" }, { zones });
  const boundary = quote(ride(2, { pickupAt: "2026-01-15T04:00:00Z", returnAt: "2026-01-15T04:02:00Z" }), { type: "standard" }, { zones });
  assert.deepEqual(night.discounts, [{ code: "night", amount: 750 }]);
  assert.equal(night.total, 1750);
  assert.deepEqual(boundary.discounts, []);
});

test("adds out-of-zone and unreturned fees without applying them to time charge", () => {
  const result = quote(ride(24 * 60 + 1, { returnStation: "outside" }), { type: "standard" }, { zones });
  assert.deepEqual(result.fees, [
    { code: "out-of-zone", amount: OUT_OF_ZONE_FEE },
    { code: "unreturned", amount: UNRETURNED_FEE },
  ]);
  assert.equal(result.total, result.timeCharge + OUT_OF_ZONE_FEE + UNRETURNED_FEE);
});

test("combines night discount, reduced fare, and reduced fee", () => {
  const result = quote(ride(2, { pickupAt: "2026-01-15T02:00:00Z", returnAt: "2026-01-15T02:02:00Z", returnStation: "outside" }), { type: "reduced" }, { zones });
  assert.deepEqual(result.discounts, [{ code: "reduced", amount: 1250 }, { code: "night", amount: 375 }]);
  assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
  assert.equal(result.total, 8375);
});

test("applies the daily cap after fare and night discounts", () => {
  const dayCap = { remaining: () => 1000, record: () => {} };
  const result = quote(ride(2), { type: "standard", id: "r1" }, { zones, dayCap });
  assert.deepEqual(result.discounts, [{ code: "day-cap", amount: 1500 }]);
  assert.equal(result.total, 1000);
});

test("rejects invalid rides and requires rider id with a cap ledger", () => {
  assert.throws(() => quote(null, { type: "standard" }, { zones }), QuoteError);
  assert.throws(() => quote(ride(2, { bike: "cargo" }), { type: "standard" }, { zones }), /unknown bike type/);
  assert.throws(() => quote(ride(2), { type: "standard" }, { zones, dayCap: {} }), /rider.id is required/);
});
