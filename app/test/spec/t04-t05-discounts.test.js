import test from "node:test";
import assert from "node:assert/strict";
import { QuoteError, quote } from "../../src/tariff.js";
import { HOUR, MINUTE, byCode, quoteOf, reduced, ride, subscriber, subscriberWithConcession } from "./helpers.js";

// T4 — subscription (docs/spec/tariffs.md:74-77; examples :81, :82).
// Classic: the first 45 minutes are free, blocks count from the 46th minute. E-bike: 20 % off T3, no free minutes.
// Columns: id, name, bike, minutes, T3 charge (:62-67), subscription discount, amount due.
const t4 = [
  ["TC-16", "classic 40 min → 0", "classic", 40, 5000, 5000, 0], // :81
  ["TC-17", "classic 45 min → 0", "classic", 45, 5000, 5000, 0], // :74-75
  ["TC-18", "classic 46 min → 1 block", "classic", 46, 5000, 2500, 2500], // :74-75
  ["TC-19", "classic 75 min → 30 paid min → 1 block", "classic", 75, 7500, 5000, 2500], // :74-75
  ["TC-19", "classic 76 min → 31 paid min → 2 blocks", "classic", 76, 7500, 2500, 5000], // :74-75
  ["TC-20", "classic 100 min → 55 paid min → 2 blocks", "classic", 100, 10000, 5000, 5000], // :82
  ["TC-21", "e-bike 40 min → 8000 − 20 %", "ebike", 40, 8000, 1600, 6400], // :76-77
  ["TC-22", "e-bike 75 min → 12000 − 20 %", "ebike", 75, 12000, 2400, 9600], // :76-77, :70
];
for (const [id, name, bike, minutes, timeCharge, off, total] of t4) {
  test(`T4: ${id} subscriber, ${name}`, () => {
    const result = quoteOf(minutes * MINUTE, { bike }, subscriber);
    assert.equal(result.timeCharge, timeCharge);
    assert.deepEqual(result.discounts, [{ code: "subscription", amount: off }]);
    assert.equal(result.total, total);
  });
}

// §4 (docs/spec/tariffs.md:148-149): an unknown rider category is rejected; categories — :39-40.
test("T4: TC-23 unknown rider category `vip` is rejected with an explanation", () => {
  const r = ride(30 * MINUTE);
  assert.throws(() => quote(r, { type: "vip" }), (err) => err instanceof QuoteError && err.message.length > 0);
});

// T5 — reduced fare −50 % (docs/spec/tariffs.md:86-87; example :93); a subscriber with the right to the reduced fare
// gets whichever of the two leaves less to pay, the subscription when equal (:89-91; example :94-96).
// Columns: id, name, rider, bike, minutes, T3 charge, applied discount, amount due.
const t5 = [
  ["TC-24", "reduced, classic 40 min → 5000 − 50 %", reduced, "classic", 40, 5000, ["reduced", 2500], 2500], // :93
  ["TC-25", "reduced, e-bike 30 min → 4000 − 50 %", reduced, "ebike", 30, 4000, ["reduced", 2000], 2000], // :86-87
  ["TC-26", "subscriber+concession, classic 80 min: subscription 5000 > reduced 3750 → 3750", subscriberWithConcession, "classic", 80, 7500, ["reduced", 3750], 3750], // :94-96
  ["TC-27", "subscriber+concession, classic 60 min: subscription 2500 = reduced 2500 → 2500", subscriberWithConcession, "classic", 60, 5000, ["subscription", 2500], 2500], // :89-91
  ["TC-28", "subscriber+concession, classic 40 min: subscription 0 < reduced 2500 → 0", subscriberWithConcession, "classic", 40, 5000, ["subscription", 5000], 0], // :81, :89-91
  ["TC-29", "subscriber+concession, e-bike 40 min: subscription 6400 > reduced 4000 → 4000", subscriberWithConcession, "ebike", 40, 8000, ["reduced", 4000], 4000], // :76-77, :89-91
];
for (const [id, name, rider, bike, minutes, timeCharge, [code, amount], total] of t5) {
  test(`T5: ${id} ${name}`, () => {
    const result = quoteOf(minutes * MINUTE, { bike }, rider);
    assert.equal(result.timeCharge, timeCharge);
    assert.deepEqual(result.discounts, [{ code, amount }]);
    assert.equal(result.total, total);
  });
}

// :90-91 — «якщо суми однакові — застосовується абонемент»: exactly one discount, the subscription, not both.
test("T5: TC-27 equal amounts → the subscription is applied", () => {
  const result = quoteOf(60 * MINUTE, {}, subscriberWithConcession);
  assert.deepEqual(result.discounts, [{ code: "subscription", amount: 2500 }]);
});

// :87 — the reduced fare does not apply to fees (T7 :112 — 150 грн).
test("T5: TC-30 reduced fare does not apply to the out-of-zone fee: 2500 + 15000", () => {
  const result = quoteOf(40 * MINUTE, { station: "X01" }, reduced);
  assert.deepEqual(result.discounts, [{ code: "reduced", amount: 2500 }]);
  assert.deepEqual(result.fees, [{ code: "out-of-zone", amount: 15000 }]);
  assert.equal(result.total, 17500);
});

// :87, :100-101, :120 — 50 blocks = 125000 − 50 % = 62500 → capped at 30000; the T8 fee 200000 has no reduction.
test("T5: TC-31 reduced, classic 25 h: capped 30000 + unreturned fee 200000 without concession", () => {
  const result = quoteOf(25 * HOUR, {}, reduced);
  assert.equal(result.timeCharge, 125000);
  assert.deepEqual(byCode(result.discounts), [
    { code: "day-cap", amount: 32500 },
    { code: "reduced", amount: 62500 },
  ]);
  assert.deepEqual(result.fees, [{ code: "unreturned", amount: 200000 }]);
  assert.equal(result.total, 230000);
});
