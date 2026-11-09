import test from "node:test";
import assert from "node:assert/strict";
import { quote, QuoteError, discount } from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";

const zones = { zoneOf: (station) => ({ central: "in", edge: "out" })[station] };
const ride = (minutes, { pickupAt = "2026-09-16T10:00:00Z", bike = "classic", returnStation = "central" } = {}) => ({
  pickupAt,
  returnAt: new Date(Date.parse(pickupAt) + minutes * 60_000).toISOString(),
  bike,
  returnStation,
});

test("classic rides are free below two minutes and billed in 30-minute blocks", () => {
  assert.equal(quote(ride(1), { type: "standard" }, { zones }).total, 0);
  assert.equal(quote(ride(2), { type: "standard" }, { zones }).total, 2500);
  assert.equal(quote(ride(30), { type: "standard" }, { zones }).total, 2500);
  assert.equal(quote(ride(31), { type: "standard" }, { zones }).total, 5000);
});

test("ebike block rate and reduced fare are applied", () => {
  const result = quote(ride(30, { bike: "ebike" }), { type: "reduced" }, { zones });
  assert.equal(result.timeCharge, 4000);
  assert.deepEqual(result.discounts, [{ code: "reduced", amount: 2000 }]);
  assert.equal(result.total, 2000);
});

test("subscriber receives 45 free minutes and an ebike subscription discount", () => {
  assert.equal(quote(ride(45), { type: "subscriber" }, { zones }).total, 0);
  const result = quote(ride(76, { bike: "ebike" }), { type: "subscriber" }, { zones });
  assert.equal(result.timeCharge, 12000);
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 5600 }]);
  assert.equal(result.total, 6400);
});

test("subscriber concession uses the cheaper of subscription and reduced plans", () => {
  const result = quote(ride(30), { type: "subscriber", concession: true }, { zones });
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
  assert.equal(result.total, 0);
});

test("night discount applies before the daily cap and out-of-zone fee is separate", () => {
  const cap = createDayCap({ limit: 1000 });
  const result = quote(ride(30, { pickupAt: "2026-09-16T02:00:00Z", returnStation: "edge" }),
    { type: "standard", id: "r1" }, { zones, dayCap: cap });
  assert.deepEqual(result.discounts, [
    { code: "night", amount: 750 },
    { code: "day-cap", amount: 750 },
  ]);
  assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
  assert.equal(result.total, 16000);
  assert.equal(cap.chargedOn("r1", "2026-09-16"), 1000);
});

test("rides longer than 24 hours incur the unreturned fee", () => {
  const result = quote(ride(1441), { type: "standard" }, { zones });
  assert.deepEqual(result.fees, [{ code: "unreturned", amount: 200000 }]);
});

test("invalid rides and riders are rejected with QuoteError", () => {
  assert.throws(() => quote(null, { type: "standard" }, { zones }), QuoteError);
  assert.throws(() => quote({ ...ride(10), returnAt: "bad" }, { type: "standard" }, { zones }), QuoteError);
  assert.throws(() => quote({ ...ride(10), bike: "scooter" }, { type: "standard" }, { zones }), QuoteError);
  assert.throws(() => quote(ride(10), { type: "guest" }, { zones }), QuoteError);
  assert.throws(() => quote(ride(10), { type: "standard" }, { zones: { zoneOf: () => undefined } }), QuoteError);
  assert.throws(() => quote(ride(10), { type: "standard" }, { zones, dayCap: createDayCap() }), /rider.id is required/);
});

test("discount rounds the payable amount down to a kopeck", () => {
  assert.equal(discount(101, 50), 51);
});
