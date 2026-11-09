import test from "node:test";
import assert from "node:assert/strict";
import { quote, QuoteError, discount } from "../../app/src/tariff.js";

const zones = {
  zoneOf(station) {
    if (station === "inside") return "in";
    if (station === "outside") return "out";
    return undefined;
  },
};

function ride({
  pickupAt = "2026-09-16T09:00:00Z",
  returnAt = "2026-09-16T09:01:00Z",
  bike = "classic",
  returnStation = "inside",
} = {}) {
  return { pickupAt, returnAt, bike, returnStation };
}

test("discount rounds the amount left down to a kopeck", () => {
  assert.equal(discount(2501, 50), 1251);
  assert.equal(discount(2501, 20), 501);
});

test("a ride shorter than two minutes has no time charge", () => {
  assert.deepEqual(quote(ride(), { type: "standard" }, { zones }), {
    minutes: 1,
    timeCharge: 0,
    discounts: [],
    fees: [],
    total: 0,
  });
});

test("two minutes starts the first 30-minute block", () => {
  const result = quote(ride({ returnAt: "2026-09-16T09:02:00Z" }), { type: "standard" }, { zones });
  assert.equal(result.minutes, 2);
  assert.equal(result.timeCharge, 2500);
  assert.equal(result.total, 2500);
});

test("duration is rounded to the nearest minute and charged in 30-minute blocks", () => {
  const result = quote(ride({ returnAt: "2026-09-16T09:30:30Z" }), { type: "standard" }, { zones });
  assert.equal(result.minutes, 31);
  assert.equal(result.timeCharge, 5000);
});

test("reduced riders receive half off the time charge and zone fee", () => {
  const result = quote(
    ride({ returnAt: "2026-09-16T09:02:00Z", returnStation: "outside" }),
    { type: "reduced" },
    { zones },
  );
  assert.deepEqual(result.discounts, [{ code: "reduced", amount: 1250 }]);
  assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 7500 }]);
  assert.equal(result.total, 8750);
});

test("subscriber pays no time charge for a 45-minute classic ride", () => {
  const result = quote(
    ride({ returnAt: "2026-09-16T09:45:00Z" }),
    { type: "subscriber" },
    { zones },
  );
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 5000 }]);
  assert.equal(result.total, 0);
});

test("subscriber with concession gets the cheaper available fare plan", () => {
  const result = quote(
    ride({ returnAt: "2026-09-16T09:30:00Z" }),
    { type: "subscriber", concession: true },
    { zones },
  );
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
  assert.equal(result.total, 0);
});

test("a night discount applies before the daily cap", () => {
  const cap = { remaining: () => 1000, record() {} };
  const result = quote(
    ride({ pickupAt: "2026-09-16T02:00:00Z", returnAt: "2026-09-16T02:02:00Z" }),
    { type: "standard", id: "r1" },
    { zones, dayCap: cap },
  );
  assert.deepEqual(result.discounts, [
    { code: "night", amount: 750 },
    { code: "day-cap", amount: 750 },
  ]);
  assert.equal(result.total, 1000);
});

test("out-of-zone and unreturned fees are both included", () => {
  const result = quote(
    ride({
      returnAt: "2026-09-17T09:01:00Z",
      returnStation: "outside",
    }),
    { type: "standard" },
    { zones },
  );
  assert.deepEqual(result.fees, [
    { code: "out-of-zone", amount: 15000 },
    { code: "unreturned", amount: 200000 },
  ]);
  assert.equal(result.total, 245000);
});

test("invalid rides, riders, and stations throw QuoteError", () => {
  assert.throws(() => quote(null, { type: "standard" }, { zones }), QuoteError);
  assert.throws(() => quote(ride({ returnAt: "bad" }), { type: "standard" }, { zones }), QuoteError);
  assert.throws(
    () => quote(ride({ pickupAt: "2026-09-16T10:00:00Z" }), { type: "standard" }, { zones }),
    /returnAt is before pickupAt/,
  );
  assert.throws(() => quote(ride({ bike: "cargo" }), { type: "standard" }, { zones }), /unknown bike type/);
  assert.throws(() => quote(ride({ returnStation: "missing" }), { type: "standard" }, { zones }), /unknown station/);
  assert.throws(() => quote(ride(), { type: "unknown" }, { zones }), /unknown rider type/);
});

test("a daily cap requires a rider id and records the billed amount", () => {
  const booked = [];
  const cap = {
    remaining(id, pickupAt) {
      assert.equal(id, "rider-1");
      assert.equal(pickupAt, Date.parse("2026-09-16T09:00:00Z"));
      return 1000;
    },
    record(...args) { booked.push(args); },
  };
  assert.throws(() => quote(ride(), { type: "standard" }, { zones, dayCap: cap }), /rider.id is required/);
  const result = quote(ride({ returnAt: "2026-09-16T09:02:00Z" }), { type: "standard", id: "rider-1" }, { zones, dayCap: cap });
  assert.equal(result.total, 1000);
  assert.deepEqual(booked, [["rider-1", Date.parse("2026-09-16T09:00:00Z"), 1000]]);
});
