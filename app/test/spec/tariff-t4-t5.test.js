// T4 — subscription, T5 — reduced fare / concession vs subscription choice
// Expected values: docs/test-cases.md, docs/spec/tariffs.md
import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";

const subscriber  = { type: "subscriber" };
const reduced     = { type: "reduced" };
const ride = (pickupAt, returnAt, bike = "classic", returnStation = "S01") =>
  ({ pickupAt, returnAt, bike, returnStation });

// T4 — TC-19 to TC-25: classic bike, subscriber — 45 free minutes then 25 грн/block
// spec:tariffs.md:74-75,81-82
test("T4: TC-19 to TC-25 — classic subscriber: 45 free min, then full blocks", () => {
  for (const { id, returnAt, expTotal } of [
    { id: "TC-19", returnAt: "2026-09-16T10:40:00+03:00", expTotal: 0    }, // 40 min ≤ 45 → free
    { id: "TC-20", returnAt: "2026-09-16T10:45:00+03:00", expTotal: 0    }, // exactly 45 min → free
    { id: "TC-21", returnAt: "2026-09-16T10:46:00+03:00", expTotal: 2500 }, // 46 min → 1 paid min → 1 block
    { id: "TC-22", returnAt: "2026-09-16T10:45:01+03:00", expTotal: 2500 }, // 45 min 1 s → 46 min → 1 block
    { id: "TC-23", returnAt: "2026-09-16T11:15:00+03:00", expTotal: 2500 }, // 75 min → 30 paid min → 1 block
    { id: "TC-24", returnAt: "2026-09-16T11:16:00+03:00", expTotal: 5000 }, // 76 min → 31 paid min → 2 blocks
    { id: "TC-25", returnAt: "2026-09-16T11:40:00+03:00", expTotal: 5000 }, // 100 min → 55 paid min → 2 blocks
  ]) {
    const r = quote(ride("2026-09-16T10:00:00+03:00", returnAt), subscriber);
    assert.equal(r.total, expTotal, id);
  }
});

// T4 — TC-26 to TC-29: ebike, subscriber — no free minutes; 20% discount (spec:tariffs.md:76-77)
test("T4: TC-26 to TC-29 — ebike subscriber: no free minutes, −20 % on time charge", () => {
  for (const { id, returnAt, expTotal } of [
    { id: "TC-26", returnAt: "2026-09-16T10:10:00+03:00", expTotal: 3200 }, // 10 min → 1 block 4000 − 20 %
    { id: "TC-27", returnAt: "2026-09-16T10:30:00+03:00", expTotal: 3200 }, // 30 min → 1 block − 20 %
    { id: "TC-28", returnAt: "2026-09-16T10:31:00+03:00", expTotal: 6400 }, // 31 min → 2 blocks − 20 %
    { id: "TC-29", returnAt: "2026-09-16T11:15:00+03:00", expTotal: 9600 }, // 75 min → 3 blocks − 20 %
  ]) {
    const r = quote(ride("2026-09-16T10:00:00+03:00", returnAt, "ebike"), subscriber);
    assert.equal(r.total, expTotal, id);
  }
});

// T5 — TC-30, TC-31: simple reduced fare — 50% off (spec:tariffs.md:86,93)
test("T5: TC-30 TC-31 — reduced fare: −50 % on time charge", () => {
  for (const { id, returnAt, bike, expTotal } of [
    { id: "TC-30", returnAt: "2026-09-16T10:40:00+03:00", bike: "classic", expTotal: 2500 }, // 2 blocks 5000 − 50%
    { id: "TC-31", returnAt: "2026-09-16T10:31:00+03:00", bike: "ebike",   expTotal: 4000 }, // 2 blocks 8000 − 50%
  ]) {
    const r = quote(ride("2026-09-16T10:00:00+03:00", returnAt, bike), reduced);
    assert.equal(r.total, expTotal, id);
  }
});

// T5 — TC-32: reduced fare + out-of-zone fee — fee not discounted (spec:tariffs.md:87)
test("T5: TC-32 — reduced fare does not apply to out-of-zone fee", () => {
  // classic, reduced, X02, 20 min → 2500 − 50% = 1250; fee 15000 unchanged → 16250
  const r = quote(
    ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:20:00+03:00", "classic", "X02"),
    reduced,
  );
  assert.equal(r.total, 16250, "TC-32: total (1250 + 15000)");
});

// T5 — TC-33 to TC-39: subscriber + concession — cheaper of subscription vs reduced (spec:tariffs.md:90-94)
test("T5: TC-33 to TC-39 — subscriber+concession: cheaper of subscription vs reduced wins", () => {
  const conc = { type: "subscriber", concession: true };
  for (const { id, returnAt, bike, expTotal, expDiscounts } of [
    // TC-33: 80 min → sub 5000, reduced 3750 → reduced wins
    { id: "TC-33", returnAt: "2026-09-16T11:20:00+03:00", bike: "classic", expTotal: 3750 },
    // TC-34: 50 min → sub 2500 = reduced 2500 → tie → subscription wins (spec:tariffs.md:90-91);
    // docs/test-cases.md TC-34: only the subscription discount line (−25,00 грн), no reduced line.
    // Kills M054 (plan.amount > best.amount → >=): with >= the later plan (reduced) wins the tie.
    { id: "TC-34", returnAt: "2026-09-16T10:50:00+03:00", bike: "classic", expTotal: 2500,
      expDiscounts: [{ code: "subscription", amount: 2500 }] },
    // TC-35: 91 min → sub 5000 = reduced 5000 → subscription wins
    { id: "TC-35", returnAt: "2026-09-16T11:31:00+03:00", bike: "classic", expTotal: 5000 },
    // TC-36: 75 min → sub 2500 < reduced 3750 → subscription wins
    { id: "TC-36", returnAt: "2026-09-16T11:15:00+03:00", bike: "classic", expTotal: 2500 },
    // TC-37: 76 min → sub 5000 > reduced 3750 → reduced wins
    { id: "TC-37", returnAt: "2026-09-16T11:16:00+03:00", bike: "classic", expTotal: 3750 },
    // TC-38: ebike 30 min → sub 3200 > reduced 2000 → reduced wins → 2000
    { id: "TC-38", returnAt: "2026-09-16T10:30:00+03:00", bike: "ebike",   expTotal: 2000 },
    // TC-39: classic 45 min → sub 0 < reduced 2500 → subscription wins → 0
    { id: "TC-39", returnAt: "2026-09-16T10:45:00+03:00", bike: "classic", expTotal: 0    },
  ]) {
    const r = quote(ride("2026-09-16T10:00:00+03:00", returnAt, bike), conc);
    assert.equal(r.total, expTotal, id);
    // The exact discount lines are fixed by docs/test-cases.md only for TC-34.
    if (expDiscounts) assert.deepEqual(r.discounts, expDiscounts, `${id}: discounts`);
  }
});

// T5 — TC-40: reduced + 25-hour ride — unreturned fee not discounted (spec:tariffs.md:87)
test("T5: TC-40 — reduced fare + T6 cap + T8 fee: fee not discounted", () => {
  // 25 h → 50 blocks = 125000 − 50% = 62500 → cap 30000; unreturned 200000 unchanged → 230000
  const r = quote(
    { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-17T11:00:00+03:00", bike: "classic", returnStation: "S01" },
    reduced,
  );
  assert.equal(r.total, 230000, "TC-40: total (30000 + 200000)");
});
