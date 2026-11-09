import test from "node:test";
import assert from "node:assert/strict";
import { quote, QuoteError, discount } from "../../src/tariff.js";
import { createDayCap, DAY_CAP } from "../../src/day-cap.js";
import { formatUah, formatReceipt } from "../../src/receipt.js";

const ride = (pickupAt, returnAt, extra = {}) => ({
  pickupAt,
  returnAt,
  bike: "classic",
  returnStation: "S01",
  ...extra,
});

const standard = { type: "standard" };
const subscriber = { type: "subscriber" };
const reduced = { type: "reduced" };
const subscriberConcession = { type: "subscriber", concession: true };

// --- T1: Duration ---

test("T1: 10:00:00 → 10:12:40 = 13 minutes (ceil)", () => {
  const r = quote(ride("2026-09-16T10:00:00Z", "2026-09-16T10:12:40Z"), standard);
  assert.equal(r.minutes, 13);
});

test("T1: 14:05:00 → 14:41:00 = 36 minutes", () => {
  const r = quote(ride("2026-09-16T14:05:00Z", "2026-09-16T14:41:00Z"), standard);
  assert.equal(r.minutes, 36);
});

test("T1: 30 min 20 sec → 31 minutes (rounded up)", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:20Z"), standard);
  assert.equal(r.minutes, 31);
  assert.equal(r.timeCharge, 5000);
});

test("T1: exactly 30 min → 30 minutes, 1 block", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z"), standard);
  assert.equal(r.minutes, 30);
  assert.equal(r.timeCharge, 2500);
});

// --- T2: False start ---

test("T2: 50 sec ride (1 min after ceil) → free", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:00:50Z"), standard);
  assert.equal(r.minutes, 1);
  assert.equal(r.timeCharge, 0);
  assert.equal(r.total, 0);
});

test("T2: exactly 2 min → free (≤2)", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:02:00Z"), standard);
  assert.equal(r.minutes, 2);
  assert.equal(r.timeCharge, 0);
  assert.equal(r.total, 0);
});

test("T2: 2 min 1 sec → 3 min (ceil) → 1 block = 2500", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:02:01Z"), standard);
  assert.equal(r.minutes, 3);
  assert.equal(r.timeCharge, 2500);
});

test("T2: false start with out-of-zone still charges fee", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:01:00Z", { returnStation: "X01" }), standard);
  assert.equal(r.timeCharge, 0);
  assert.equal(r.fees.length, 1);
  assert.equal(r.fees[0].amount, 15000);
  assert.equal(r.total, 15000);
});

// --- T3: Hourly charge ---

test("T3: classic 50 min → 2 blocks = 5000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:50:00Z"), standard);
  assert.equal(r.timeCharge, 5000);
  assert.equal(r.total, 5000);
});

test("T3: ebike 75 min → 3 blocks = 12000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:15:00Z", { bike: "ebike" }), standard);
  assert.equal(r.timeCharge, 12000);
  assert.equal(r.total, 12000);
});

test("T3: classic 30 min → 1 block = 2500", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z"), standard);
  assert.equal(r.timeCharge, 2500);
});

test("T3: classic 31 min → 2 blocks = 5000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:31:00Z"), standard);
  assert.equal(r.timeCharge, 5000);
});

test("T3: classic 60 min → 2 blocks = 5000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:00:00Z"), standard);
  assert.equal(r.timeCharge, 5000);
});

test("T3: classic 61 min → 3 blocks = 7500", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:01:00Z"), standard);
  assert.equal(r.timeCharge, 7500);
});

// --- T4: Subscription ---

test("T4: subscriber classic 40 min → free (first 45 min)", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z"), subscriber);
  assert.equal(r.total, 0);
});

test("T4: subscriber classic 100 min → 55 paid → 2 blocks = 5000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:40:00Z"), subscriber);
  assert.equal(r.total, 5000);
});

test("T4: subscriber classic 45 min → free (boundary)", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:45:00Z"), subscriber);
  assert.equal(r.total, 0);
});

test("T4: subscriber classic 46 min → 1 paid → 1 block = 2500", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:46:00Z"), subscriber);
  assert.equal(r.total, 2500);
});

test("T4: subscriber ebike 40 min → 2 blocks × 4000 = 8000 − 20% = 6400 (no free minutes)", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { bike: "ebike" }), subscriber);
  assert.equal(r.total, 6400);
});

test("T4: subscriber ebike 75 min → 3 blocks × 4000 = 12000 − 20% = 9600", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:15:00Z", { bike: "ebike" }), subscriber);
  assert.equal(r.total, 9600);
});

// --- T5: Reduced fare ---

test("T5: reduced classic 40 min → 5000 − 50% = 2500", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z"), reduced);
  assert.equal(r.total, 2500);
});

test("T5: reduced fare does NOT apply to out-of-zone fee", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { returnStation: "X01" }), reduced);
  assert.equal(r.fees[0].amount, 15000);
  assert.equal(r.total, 17500);
});

test("T5: subscriber+concession classic 80 min → reduced 3750 < subscription 5000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:20:00Z"), subscriberConcession);
  assert.equal(r.total, 3750);
  assert.ok(r.discounts.some((d) => d.code === "reduced"));
});

test("T5: subscriber+concession classic 46 min → equal → subscription wins", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:46:00Z"), subscriberConcession);
  assert.ok(r.discounts.some((d) => d.code === "subscription"));
});

// --- T6: Daily cap ---

test("T6: 3 ebike rides of 80 min → capped at 30000", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-1", type: "standard" };
  const results = [];
  for (const [from, to] of [["07:00", "08:20"], ["11:00", "12:20"], ["16:00", "17:20"]]) {
    results.push(quote(ride(`2026-09-16T${from}:00Z`, `2026-09-16T${to}:00Z`, { bike: "ebike" }), rider, { dayCap }));
  }
  assert.equal(results[0].total, 12000);
  assert.equal(results[1].total, 12000);
  assert.equal(results[2].total, 6000);
});

test("T6: ride pickup at 23:40 Kyiv → belongs to that Kyiv date", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-2", type: "standard" };
  quote(ride("2026-09-16T20:00:00Z", "2026-09-16T21:20:00Z", { bike: "ebike" }), rider, { dayCap });
  quote(ride("2026-09-16T20:40:00Z", "2026-09-16T21:20:00Z"), rider, { dayCap });
  assert.ok(dayCap.chargedOn("rider-2", "2026-09-16") > 0);
});

test("T6: fees are not limited by the daily cap", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-3", type: "standard" };
  for (const [from, to] of [["07:00", "08:20"], ["11:00", "12:20"], ["16:00", "17:20"]]) {
    quote(ride(`2026-09-16T${from}:00Z`, `2026-09-16T${to}:00Z`, { bike: "ebike" }), rider, { dayCap });
  }
  const r = quote(ride("2026-09-16T18:00:00Z", "2026-09-16T18:20:00Z", { returnStation: "X01" }), rider, { dayCap });
  assert.equal(r.fees[0].amount, 15000);
});

// --- T7: Out of zone ---

test("T7: classic 20 min X02 → 2500 + 15000 = 17500", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:20:00Z", { returnStation: "X02" }), standard);
  assert.equal(r.fees[0].amount, 15000);
  assert.equal(r.total, 17500);
});

test("T7: classic 20 min S03 (in zone) → no fee", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:20:00Z", { returnStation: "S03" }), standard);
  assert.equal(r.fees.length, 0);
  assert.equal(r.total, 2500);
});

// --- T8: Unreturned bike ---

test("T8: classic 25 hours → capped time + 200000 = 230000", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-8", type: "standard" };
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-17T08:00:00Z"), rider, { dayCap });
  assert.ok(r.fees.some((f) => f.code === "unreturned" && f.amount === 200000));
});

test("T8: exactly 24 hours (1440 min) → no unreturned fee", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-17T07:00:00Z"), standard);
  assert.ok(!r.fees.some((f) => f.code === "unreturned"));
});

test("T8: 24 hours 1 min (1441 min) → unreturned fee", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-17T07:01:00Z"), standard);
  assert.ok(r.fees.some((f) => f.code === "unreturned" && f.amount === 200000));
});

test("T8: >24h + out-of-zone → both fees", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  assert.equal(r.fees.length, 2);
  assert.ok(r.fees.some((f) => f.code === "out-of-zone"));
  assert.ok(r.fees.some((f) => f.code === "unreturned"));
});

// --- T9: Rounding ---

test("T9: discount rounds down (in user's favor)", () => {
  const d = discount(1235, 30);
  assert.equal(1235 - d, 864);
});

test("T9: formatUah 230000 → '2 300,00 грн'", () => {
  assert.equal(formatUah(230000), "2 300,00 грн");
});

test("T9: formatUah -2500 → '-25,00 грн'", () => {
  assert.equal(formatUah(-2500), "-25,00 грн");
});

// --- T10: Night discount ---

test("T10: classic 01:10→01:40 Kyiv → 2500 − 30% = 1750", () => {
  const r = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:40:00Z"), standard);
  assert.equal(r.timeCharge, 2500);
  assert.equal(r.total, 1750);
});

test("T10: pickup at 05:59 Kyiv → night discount applies", () => {
  const r = quote(ride("2026-09-16T02:59:00Z", "2026-09-16T03:29:00Z"), standard);
  assert.ok(r.discounts.some((d) => d.code === "night"));
});

test("T10: pickup at 06:00 Kyiv → no night discount", () => {
  const r = quote(ride("2026-09-16T03:00:00Z", "2026-09-16T03:30:00Z"), standard);
  assert.ok(!r.discounts.some((d) => d.code === "night"));
});

// --- §4: Invalid data ---

test("§4: returnAt before pickupAt → error", () => {
  assert.throws(() => quote(ride("2026-09-16T08:00:00Z", "2026-09-16T07:00:00Z"), standard), QuoteError);
});

test("§4: unknown bike type → error", () => {
  assert.throws(() => quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z", { bike: "trike" }), standard), QuoteError);
});

test("§4: unknown station → error", () => {
  assert.throws(() => quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z", { returnStation: "Z99" }), standard), QuoteError);
});

test("§4: null ride → error", () => {
  assert.throws(() => quote(null, standard), QuoteError);
});

test("§4: null rider → error", () => {
  assert.throws(() => quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z"), null), QuoteError);
});

test("§4: non-string pickupAt → error", () => {
  assert.throws(() => quote({ pickupAt: 12345, returnAt: "2026-09-16T07:30:00Z", bike: "classic", returnStation: "S01" }, standard), QuoteError);
});

test("§4: returnAt equals pickupAt (0 min ride) → no error", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:00:00Z"), standard);
  assert.equal(r.minutes, 0);
  assert.equal(r.total, 0);
});

// --- Mutation killers ---

test("T2: false start (2 min) has no discount entry in discounts array", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:02:00Z"), subscriber);
  assert.equal(r.discounts.length, 0);
});

test("T6: day-cap discount amount is exact", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-cap", type: "standard" };
  quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:20:00Z", { bike: "ebike" }), rider, { dayCap });
  quote(ride("2026-09-16T11:00:00Z", "2026-09-16T12:20:00Z", { bike: "ebike" }), rider, { dayCap });
  const r3 = quote(ride("2026-09-16T16:00:00Z", "2026-09-16T17:20:00Z", { bike: "ebike" }), rider, { dayCap });
  const capDiscount = r3.discounts.find((d) => d.code === "day-cap");
  assert.ok(capDiscount);
  assert.equal(capDiscount.amount, 6000);
});

test("T6: remaining returns exact value after recording", () => {
  const dayCap = createDayCap();
  dayCap.record("rider-x", "2026-09-16T08:00:00Z", 12000);
  assert.equal(dayCap.remaining("rider-x", "2026-09-16T10:00:00Z"), 18000);
});

test("T6: chargedOn returns 0 for unknown rider", () => {
  const dayCap = createDayCap();
  assert.equal(dayCap.chargedOn("nobody", "2026-09-16"), 0);
});

test("T1: exact minute boundary (60000 ms = 1 min exactly)", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:03:00Z"), standard);
  assert.equal(r.minutes, 3);
});

test("T1: 1 sec over → ceil gives extra minute", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:03:01Z"), standard);
  assert.equal(r.minutes, 4);
});

test("T10: night ride with zero due has no night discount entry", () => {
  const r = quote(ride("2026-09-15T22:00:00Z", "2026-09-15T22:01:00Z"), standard);
  assert.equal(r.timeCharge, 0);
  assert.ok(!r.discounts.some((d) => d.code === "night"));
});

test("T4: standard rider has no discount entry", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z"), standard);
  assert.equal(r.discounts.length, 0);
  assert.equal(r.total, 5000);
});

test("T6: when due equals remaining cap exactly, no day-cap discount", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-eq", type: "standard" };
  dayCap.record("rider-eq", "2026-09-16T08:00:00Z", 27500);
  const r = quote(ride("2026-09-16T10:00:00Z", "2026-09-16T10:30:00Z"), rider, { dayCap });
  assert.equal(r.total, 2500);
  assert.ok(!r.discounts.some((d) => d.code === "day-cap"));
});

test("T6: remaining is exact for fresh rider", () => {
  const dayCap = createDayCap();
  assert.equal(dayCap.remaining("fresh", "2026-09-16T08:00:00Z"), 30000);
});

test("§4: pickupAt as number (not string) → error", () => {
  assert.throws(
    () => quote({ pickupAt: Date.now(), returnAt: "2026-09-16T07:30:00Z", bike: "classic", returnStation: "S01" }, standard),
    QuoteError,
  );
});

test("§4: pickupAt as invalid ISO string → error", () => {
  assert.throws(
    () => quote({ pickupAt: "not-a-date", returnAt: "2026-09-16T07:30:00Z", bike: "classic", returnStation: "S01" }, standard),
    QuoteError,
  );
});
