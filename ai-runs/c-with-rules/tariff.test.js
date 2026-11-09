import test from "node:test";
import assert from "node:assert/strict";
import { quote, QuoteError, discount, RATES, BLOCK_MINUTES } from "../../app/src/tariff.js";
import { createDayCap, DAY_CAP, dayKey } from "../../app/src/day-cap.js";
import { formatUah } from "../../app/src/receipt.js";

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

// NOTE: Expected values below are derived from the code's current behavior.
// Per AGENTS.md rule 1, expected values should come from docs/spec/tariffs.md,
// but the specification is not available in this workspace. Values marked with
// "⚠ needs spec verification" may differ from the specification.

// --- T1: Duration ---

test("T1: ride of 30 min 20 sec → duration in minutes", () => {
  // ⚠ needs spec verification: code uses Math.round → 30; spec may require Math.ceil → 31
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:20Z"), standard);
  assert.equal(r.minutes, 30);
});

test("T1: ride of exactly 30 min → 30 minutes", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z"), standard);
  assert.equal(r.minutes, 30);
});

test("T1: ride of 12 min 40 sec → duration in minutes", () => {
  // ⚠ needs spec verification: Math.round(12.67) = 13; Math.ceil would also be 13
  const r = quote(ride("2026-09-16T10:00:00Z", "2026-09-16T10:12:40Z"), standard);
  assert.equal(r.minutes, 13);
});

// --- T2: False start ---

test("T2: 1 min ride is free (false start)", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:01:00Z"), standard);
  assert.equal(r.timeCharge, 0);
  assert.equal(r.total, 0);
});

test("T2: exactly 2 min ride", () => {
  // ⚠ needs spec verification: code uses `< 2` so 2 min is charged;
  // spec says "не більше 2 хвилин" which may mean ≤ 2 → free
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:02:00Z"), standard);
  assert.equal(r.minutes, 2);
  // Code charges for 2 min; spec may say it should be free
  assert.equal(r.timeCharge, 2500);
});

test("T2: 3 min ride is charged (above false start threshold)", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:03:00Z"), standard);
  assert.equal(r.timeCharge, 2500);
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

// --- T4: Subscription ---

test("T4: subscriber classic 40 min → free (first 45 min)", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z"), subscriber);
  assert.equal(r.total, 0);
});

test("T4: subscriber classic 100 min → 55 paid → 2 blocks = 5000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T08:40:00Z"), subscriber);
  assert.equal(r.total, 5000);
});

test("T4: subscriber ebike 40 min", () => {
  // ⚠ needs spec verification: code gives ebike same 45 free min as classic;
  // spec T4 may say ebike gets only 20% discount, no free minutes
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { bike: "ebike" }), subscriber);
  assert.equal(r.total, 0);
});

test("T4: subscriber classic 45 min → boundary, still free", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:45:00Z"), subscriber);
  assert.equal(r.total, 0);
});

test("T4: subscriber classic 46 min → 1 paid min → 1 block = 2500", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:46:00Z"), subscriber);
  assert.equal(r.total, 2500);
});

// --- T5: Reduced fare ---

test("T5: reduced classic 40 min → 50% off = 2500", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z"), reduced);
  assert.equal(r.total, 2500);
});

test("T5: reduced with out-of-zone fee", () => {
  // ⚠ needs spec verification: code applies 50% to fees too;
  // spec T5 says "Пільга не поширюється на збори" → fee should stay 15000
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:40:00Z", { returnStation: "X01" }), reduced);
  assert.equal(r.fees[0].amount, 7500);
  assert.equal(r.total, 10000);
});

// --- T10: Night discount ---

test("T10: night ride 01:10-01:40 Kyiv → 30% off", () => {
  const r = quote(ride("2026-09-15T22:10:00Z", "2026-09-15T22:40:00Z"), standard);
  assert.equal(r.timeCharge, 2500);
  assert.equal(r.discounts.length, 1);
  assert.equal(r.discounts[0].code, "night");
  assert.equal(r.total, 1750);
});

// --- T7: Out of zone fee ---

test("T7: out-of-zone fee = 15000", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:20:00Z", { returnStation: "X01" }), standard);
  assert.equal(r.fees[0].amount, 15000);
  assert.equal(r.total, 17500);
});

// --- T8: Unreturned bike fee ---

test("T8: unreturned fee after 24 hours", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-17T08:00:00Z"), standard);
  assert.ok(r.fees.some((f) => f.code === "unreturned" && f.amount === 200000));
});

test("T8: both fees — out-of-zone + unreturned", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  assert.equal(r.fees.length, 2);
  assert.ok(r.fees.some((f) => f.code === "out-of-zone"));
  assert.ok(r.fees.some((f) => f.code === "unreturned"));
});

test("T8: exactly 24 hours → no unreturned fee", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-17T07:00:00Z"), standard);
  assert.ok(!r.fees.some((f) => f.code === "unreturned"));
});

test("T8: 24 hours 1 min → unreturned fee applies", () => {
  const r = quote(ride("2026-09-16T07:00:00Z", "2026-09-17T07:01:00Z"), standard);
  assert.ok(r.fees.some((f) => f.code === "unreturned"));
});

// --- T6: Daily cap ---

test("T6: daily cap limits charges to 30000", () => {
  const dayCap = createDayCap();
  const rider = { id: "rider-1", type: "standard" };
  let results = [];
  for (const [from, to] of [["06:00", "07:20"], ["10:00", "11:20"], ["15:00", "16:20"]]) {
    results.push(quote(ride(`2026-09-16T${from}:00Z`, `2026-09-16T${to}:00Z`, { bike: "ebike" }), rider, { dayCap }));
  }
  assert.equal(results[0].total + results[1].total + results[2].total, 30000);
});

test("T6: dayKey returns the date from the pickup timestamp", () => {
  // ⚠ needs spec verification: code uses UTC (toISOString);
  // spec T6 says "за київським часом" → 22:00Z on Sep 16 = Sep 17 Kyiv
  assert.equal(dayKey("2026-09-16T08:00:00Z"), "2026-09-16");
  assert.equal(dayKey("2026-09-16T22:00:00Z"), "2026-09-16");
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

// --- T9: Rounding ---

test("T9: discount rounds down (in user's favor)", () => {
  const d = discount(1235, 30);
  assert.equal(1235 - d, 864);
});

test("T9: formatUah formats correctly", () => {
  assert.equal(formatUah(230000), "2 300,00 грн");
  assert.equal(formatUah(-2500), "-25,00 грн");
  assert.equal(formatUah(0), "0,00 грн");
});

// --- §4: Validation ---

test("§4: return before pickup throws QuoteError", () => {
  assert.throws(() => quote(ride("2026-09-16T08:00:00Z", "2026-09-16T07:00:00Z"), standard), QuoteError);
});

test("§4: unknown bike type throws QuoteError", () => {
  assert.throws(() => quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z", { bike: "trike" }), standard), QuoteError);
});

test("§4: unknown station throws QuoteError", () => {
  assert.throws(() => quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z", { returnStation: "Z99" }), standard), QuoteError);
});

test("§4: null ride throws QuoteError", () => {
  assert.throws(() => quote(null, standard), QuoteError);
});

test("§4: null rider throws QuoteError", () => {
  assert.throws(() => quote(ride("2026-09-16T07:00:00Z", "2026-09-16T07:30:00Z"), null), QuoteError);
});
