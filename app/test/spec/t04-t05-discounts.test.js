import test from "node:test";
import assert from "node:assert/strict";
import { QuoteError, quote } from "../../src/tariff.js";
import { HOUR, MINUTE, quoteOf, reduced, ride, subscriber, subscriberWithConcession } from "./helpers.js";

// T4 — subscription
const t4 = [
  ["TC-16", "classic 40 min → 0", "classic", 40, 0],
  ["TC-17", "classic 45 min → 0", "classic", 45, 0],
  ["TC-18", "classic 46 min → 1 block", "classic", 46, 2500],
  ["TC-19", "classic 75 min → 30 paid min → 1 block", "classic", 75, 2500],
  ["TC-19", "classic 76 min → 31 paid min → 2 blocks", "classic", 76, 5000],
  ["TC-20", "classic 100 min → 55 paid min → 2 blocks", "classic", 100, 5000],
  ["TC-21", "e-bike 40 min → 8000 − 20 %", "ebike", 40, 6400],
  ["TC-22", "e-bike 75 min → 12000 − 20 %", "ebike", 75, 9600],
];
for (const [id, name, bike, minutes, total] of t4) {
  test(`T4: ${id} subscriber, ${name}`, () => {
    assert.equal(quoteOf(minutes * MINUTE, { bike }, subscriber).total, total);
  });
}

test("T4: TC-23 unknown rider category `vip` is rejected with an explanation", () => {
  const r = ride(30 * MINUTE);
  assert.throws(() => quote(r, { type: "vip" }), (err) => err instanceof QuoteError && err.message.length > 0);
});

// T5 — reduced fare; a subscriber with concession pays the smaller of the two
const t5 = [
  ["TC-24", "reduced, classic 40 min → 5000 − 50 %", reduced, "classic", 40, 2500],
  ["TC-25", "reduced, e-bike 30 min → 4000 − 50 %", reduced, "ebike", 30, 2000],
  ["TC-26", "subscriber+concession, classic 80 min: subscription 5000 > reduced 3750 → 3750", subscriberWithConcession, "classic", 80, 3750],
  ["TC-27", "subscriber+concession, classic 60 min: subscription 2500 = reduced 2500 → 2500", subscriberWithConcession, "classic", 60, 2500],
  ["TC-28", "subscriber+concession, classic 40 min: subscription 0 < reduced 2500 → 0", subscriberWithConcession, "classic", 40, 0],
  ["TC-29", "subscriber+concession, e-bike 40 min: subscription 6400 > reduced 4000 → 4000", subscriberWithConcession, "ebike", 40, 4000],
];
for (const [id, name, rider, bike, minutes, total] of t5) {
  test(`T5: ${id} ${name}`, () => {
    assert.equal(quoteOf(minutes * MINUTE, { bike }, rider).total, total);
  });
}

test("T5: TC-27 equal amounts → the subscription is applied", () => {
  const result = quoteOf(60 * MINUTE, {}, subscriberWithConcession);
  assert.deepEqual(result.discounts.map((d) => d.code), ["subscription"]);
});

test("T5: TC-30 reduced fare does not apply to the out-of-zone fee: 2500 + 15000", () => {
  assert.equal(quoteOf(40 * MINUTE, { station: "X01" }, reduced).total, 17500);
});

test("T5: TC-31 reduced, classic 25 h: capped 30000 + unreturned fee 200000 without concession", () => {
  assert.equal(quoteOf(25 * HOUR, {}, reduced).total, 230000);
});
