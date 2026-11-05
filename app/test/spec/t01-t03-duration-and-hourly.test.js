import test from "node:test";
import assert from "node:assert/strict";
import { QuoteError, quote } from "../../src/tariff.js";
import { MINUTE, quoteOf, ride, standard } from "./helpers.js";

// T1 — duration is rounded up to whole minutes
const t1 = [
  ["TC-01", "10:00:00–10:12:40 → 13 min, 1 block", 12 * MINUTE + 40, 13, 2500, "10:00:00"],
  ["TC-02", "14:05:00–14:41:00 → 36 min, 2 blocks", 36 * MINUTE, 36, 5000, "14:05:00"],
  ["TC-03", "30 min 20 s → 31 min, 2 blocks", 30 * MINUTE + 20, 31, 5000, "10:00:00"],
  ["TC-04", "exactly 30 min → 1 block", 30 * MINUTE, 30, 2500, "10:00:00"],
];
for (const [id, name, seconds, minutes, total, time] of t1) {
  test(`T1: ${id} ${name}`, () => {
    const result = quoteOf(seconds, { time });
    assert.equal(result.minutes, minutes);
    assert.equal(result.total, total);
  });
}

test("T1: TC-05 return 1 s before pickup is rejected with an explanation", () => {
  const r = ride(-1);
  assert.throws(() => quote(r, standard), (err) => err instanceof QuoteError && err.message.length > 0);
});

// T2 — a ride of at most 2 minutes has no time charge
const t2 = [
  ["TC-06", "50 s → 1 min → 0", 50, 1, 0],
  ["TC-07", "exactly 2:00 → 2 min → 0", 2 * MINUTE, 2, 0],
  ["TC-08", "2:01 → 3 min → 1 block", 2 * MINUTE + 1, 3, 2500],
  ["TC-09", "3:00 → 3 min → 1 block", 3 * MINUTE, 3, 2500],
];
for (const [id, name, seconds, minutes, total] of t2) {
  test(`T2: ${id} ${name}`, () => {
    const result = quoteOf(seconds);
    assert.equal(result.minutes, minutes);
    assert.equal(result.timeCharge, total);
    assert.equal(result.total, total);
  });
}

test("T2: TC-10 false start returned out of zone: time charge 0, fee 15000", () => {
  const result = quoteOf(MINUTE, { station: "X01" });
  assert.equal(result.timeCharge, 0);
  assert.equal(result.total, 15000);
});

// T3 — 30-minute blocks, price by bike type
const t3 = [
  ["TC-11", "classic 50 min → 2 blocks", "classic", 50, 5000],
  ["TC-12", "e-bike 75 min → 3 blocks", "ebike", 75, 12000],
  ["TC-13", "classic 60 min → 2 blocks", "classic", 60, 5000],
  ["TC-13", "classic 61 min → 3 blocks", "classic", 61, 7500],
  ["TC-14", "e-bike 30 min → 1 block", "ebike", 30, 4000],
  ["TC-14", "e-bike 31 min → 2 blocks", "ebike", 31, 8000],
];
for (const [id, name, bike, minutes, total] of t3) {
  test(`T3: ${id} ${name}`, () => {
    assert.equal(quoteOf(minutes * MINUTE, { bike }).total, total);
  });
}

test("T3: TC-15 unknown bike type `tandem` is rejected with an explanation", () => {
  const r = ride(30 * MINUTE, { bike: "tandem" });
  assert.throws(() => quote(r, standard), (err) => err instanceof QuoteError && err.message.length > 0);
});
